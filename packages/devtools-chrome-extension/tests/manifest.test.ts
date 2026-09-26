import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ChromeExtensionManifest {
    action: {
        default_popup: string;
    };
    background: {
        service_worker: string;
        type: string;
    };
    content_scripts: Array<{
        all_frames: boolean;
        js: string[];
        matches: string[];
        run_at: string;
        world: string;
    }>;
    content_security_policy: {
        extension_pages: string;
    };
    devtools_page: string;
    host_permissions?: string[];
    manifest_version: number;
    minimum_chrome_version: string;
    permissions?: string[];
    web_accessible_resources?: Array<{
        matches: string[];
        resources: string[];
    }>;
    version: string;
}

const manifestPath = join(__dirname, '..', 'public', 'manifest.json');
const packagePath = join(__dirname, '..', 'package.json');

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('chrome extension manifest', () => {
    const manifest = readJson<ChromeExtensionManifest>(manifestPath);

    it('keeps the manifest version aligned with the package version', () => {
        const packageJson = readJson<{ version: string }>(packagePath);

        expect(manifest.version).toBe(packageJson.version);
    });

    it('declares only the minimum extension API permission', () => {
        expect(manifest.permissions).toEqual(['activeTab']);
        expect(manifest.host_permissions).toBeUndefined();
        expect(manifest.permissions).not.toContain('scripting');
        expect(manifest.permissions).not.toContain('tabs');
    });

    it('uses a Chrome-valid MV3 extension surface', () => {
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.minimum_chrome_version).toBe('102');
        expect(manifest.background.service_worker).toBe('background.js');
        expect(manifest.background.type).toBe('module');
        expect(manifest.action).toEqual({
            default_popup: 'popup.html',
            default_title: 'React DevTools'
        });
        expect(manifest.devtools_page).toBe('devtools.html');
    });

    it('limits content script matches to ordinary web pages', () => {
        expect(manifest.content_scripts).toHaveLength(3);
        expect(manifest.content_scripts).toEqual([
            expect.objectContaining({
                all_frames: true,
                js: ['prepare.js'],
                matches: ['http://*/*', 'https://*/*'],
                run_at: 'document_start',
                world: 'MAIN'
            }),
            expect.objectContaining({
                all_frames: true,
                js: ['detector.js'],
                matches: ['http://*/*', 'https://*/*'],
                run_at: 'document_start',
                world: 'MAIN'
            }),
            expect.objectContaining({
                all_frames: true,
                js: ['proxy.js'],
                matches: ['http://*/*', 'https://*/*'],
                run_at: 'document_start',
                world: 'ISOLATED'
            })
        ]);
    });

    it('uses extension-owned popup, background, and devtools entrypoints', () => {
        expect(manifest.action.default_popup).toBe('popup.html');
        expect(manifest.background).toEqual({
            service_worker: 'background.js',
            type: 'module'
        });
        expect(manifest.devtools_page).toBe('devtools.html');
        expect(manifest.web_accessible_resources).toEqual([
            {
                matches: ['<all_urls>'],
                resources: ['smoke.html']
            }
        ]);
    });

    it('locks extension pages to self-owned code and frames', () => {
        const csp = manifest.content_security_policy.extension_pages;

        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("style-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-src 'self'");
        expect(csp).toContain("connect-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).not.toContain("'unsafe-inline'");
        expect(csp).not.toContain('https:');
        expect(csp).not.toContain('http:');
    });
});
