import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = join(packageRoot, 'dist');
const chromiumExecutablePath = resolveChromiumExecutablePath();
const fallbackExtensionId = readExtensionIdFromManifestKey();

test.skip(
    chromiumExecutablePath === null,
    'No Chromium-compatible browser was found. Run `npx playwright install chromium` or install Chrome to enable this smoke test.'
);

test.describe('Chrome extension smoke', () => {
    test('loads the unpacked extension and renders the React smoke harness', async () => {
        execFileSync('npm', ['run', 'build'], {
            cwd: packageRoot,
            stdio: 'inherit'
        });

        const profilePath = mkdtempSync(
            join(tmpdir(), 'react-devtools-extension-')
        );
        const context = await chromium.launchPersistentContext(profilePath, {
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ],
            executablePath: chromiumExecutablePath ?? undefined,
            headless: false
        });

        try {
            const extensionId = await resolveExtensionId(context, profilePath);
            const page = await context.newPage();

            await page.goto(`chrome-extension://${extensionId}/smoke.html`);

            await expect(
                page.getByRole('heading', { name: 'React detected' })
            ).toBeVisible();
            await expect(
                page.getByText('DevTools panel is available.')
            ).toBeVisible();
            await expect(
                page.getByRole('region', { name: 'React root tree' })
            ).toContainText('App');
            await expect(
                page.getByRole('region', { name: 'React root tree' })
            ).toContainText('SmokeFixture');
        } finally {
            await context.close();
            rmSync(profilePath, { force: true, recursive: true });
        }
    });
});

async function resolveExtensionId(
    context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
    profilePath: string
): Promise<string> {
    const serviceWorker =
        context.serviceWorkers()[0] ??
        (await context
            .waitForEvent('serviceworker', { timeout: 2_000 })
            .catch(() => null));

    if (serviceWorker) {
        return new URL(serviceWorker.url()).host;
    }

    return (
        (await pollExtensionIdFromPreferences(profilePath)) ??
        fallbackExtensionId
    );
}

async function pollExtensionIdFromPreferences(
    profilePath: string
): Promise<string | null> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const extensionId = readExtensionIdFromPreferences(profilePath);

        if (extensionId) {
            return extensionId;
        }

        await new Promise((resolvePromise) => {
            setTimeout(resolvePromise, 100);
        });
    }

    return null;
}

function readExtensionIdFromPreferences(profilePath: string): string | null {
    const preferencesPath = join(profilePath, 'Default', 'Preferences');

    if (!existsSync(preferencesPath)) {
        return null;
    }

    const preferences = JSON.parse(readFileSync(preferencesPath, 'utf8')) as {
        extensions?: {
            settings?: Record<
                string,
                {
                    manifest?: { name?: string };
                    path?: string;
                }
            >;
        };
    };

    for (const [extensionId, settings] of Object.entries(
        preferences.extensions?.settings ?? {}
    )) {
        if (
            settings.manifest?.name === 'React DevTools' ||
            settings.path === extensionPath
        ) {
            return extensionId;
        }
    }

    return null;
}

function readExtensionIdFromManifestKey(): string {
    const manifest = JSON.parse(
        readFileSync(join(packageRoot, 'public', 'manifest.json'), 'utf8')
    ) as { key: string };
    const digest = createHash('sha256')
        .update(Buffer.from(manifest.key, 'base64'))
        .digest()
        .subarray(0, 16);

    return Array.from(digest, (byte) =>
        [byte >> 4, byte & 0x0f]
            .map((nibble) => String.fromCharCode('a'.charCodeAt(0) + nibble))
            .join('')
    ).join('');
}

function resolveChromiumExecutablePath(): string | null {
    const candidates = [
        process.env.CHROME_EXTENSION_SMOKE_BROWSER,
        chromium.executablePath(),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];

    return (
        candidates.find(
            (candidate): candidate is string =>
                typeof candidate === 'string' && existsSync(candidate)
        ) ?? null
    );
}
