import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface FirefoxExtensionManifest {
    background: {
        persistent: boolean;
        scripts: string[];
    };
    browser_action: {
        default_popup: string;
        default_title: string;
    };
    browser_specific_settings: {
        gecko: {
            id: string;
            strict_min_version: string;
        };
    };
    content_scripts: Array<{
        all_frames: boolean;
        js: string[];
        matches: string[];
        run_at: string;
        world?: string;
    }>;
    content_security_policy: string;
    devtools_page: string;
    host_permissions?: string[];
    manifest_version: number;
    permissions?: string[];
    version: string;
    web_accessible_resources?: string[];
}

const manifestPath = join(__dirname, '..', 'public', 'manifest.json');
const packagePath = join(__dirname, '..', 'package.json');

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('firefox extension manifest', () => {
    const manifest = readJson<FirefoxExtensionManifest>(manifestPath);

    it('keeps the manifest version aligned with the package version', () => {
        const packageJson = readJson<{ version: string }>(packagePath);

        expect(manifest.version).toBe(packageJson.version);
    });

    it('uses the Firefox MV2 extension surface intentionally', () => {
        expect(manifest.manifest_version).toBe(2);
        expect(manifest.browser_action).toEqual({
            default_popup: 'popup.html',
            default_title: 'React DevTools'
        });
        expect(manifest.background).toEqual({
            persistent: false,
            scripts: ['background.js']
        });
        expect(manifest.browser_specific_settings.gecko).toEqual({
            id: 'react-devtools@local.dev',
            strict_min_version: '109.0'
        });
    });

    it('declares only the minimum extension API permission', () => {
        expect(manifest.permissions).toEqual(['activeTab']);
        expect(manifest.host_permissions).toBeUndefined();
    });

    it('limits content script matches to ordinary web pages without Chrome world flags', () => {
        expect(manifest.content_scripts).toHaveLength(2);
        expect(manifest.content_scripts).toEqual([
            {
                all_frames: true,
                js: ['prepare.js'],
                matches: ['http://*/*', 'https://*/*'],
                run_at: 'document_start'
            },
            {
                all_frames: true,
                js: ['proxy.js'],
                matches: ['http://*/*', 'https://*/*'],
                run_at: 'document_start'
            }
        ]);
        expect(
            manifest.content_scripts.every(
                (script) => script.world === undefined
            )
        ).toBe(true);
    });

    it('uses extension-owned popup, background, devtools, and smoke entrypoints', () => {
        expect(manifest.browser_action.default_popup).toBe('popup.html');
        expect(manifest.devtools_page).toBe('devtools.html');
        expect(manifest.web_accessible_resources).toEqual(['smoke.html']);
    });

    it('locks extension pages to self-owned code and frames', () => {
        const csp = manifest.content_security_policy;

        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("style-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-src 'self'");
        expect(csp).toContain("connect-src 'self'");
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).not.toContain("'unsafe-inline'");
        expect(csp).not.toContain('https:');
        expect(csp).not.toContain('http:');
    });
});
