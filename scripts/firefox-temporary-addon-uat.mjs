import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PLAYGROUND_URL = 'http://localhost:3000/app-demo';
const DEFAULT_DEBUGGING_URL = 'about:debugging#/runtime/this-firefox';
const REQUIRED_FIREFOX_DIST_FILES = [
    'manifest.json',
    'background.js',
    'detector.js',
    'devtools-panel.html',
    'devtools.html',
    'devtools.js',
    'devtoolsPanel.js',
    'popup.html',
    'popup.js',
    'prepare.js',
    'prepare-loader.js',
    'proxy.js',
    'smoke.html',
    'smoke.js',
    'user-app.js'
];

export function parseCli(argv) {
    const options = {
        firefox: undefined,
        launch: true,
        manifest: 'packages/devtools-firefox-extension/dist/manifest.json',
        playgroundUrl: DEFAULT_PLAYGROUND_URL
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--no-launch') {
            options.launch = false;
        } else if (arg === '--firefox') {
            options.firefox = argv[index + 1];
            index += 1;
        } else if (arg.startsWith('--firefox=')) {
            options.firefox = arg.slice('--firefox='.length);
        } else if (arg === '--manifest') {
            options.manifest = argv[index + 1];
            index += 1;
        } else if (arg.startsWith('--manifest=')) {
            options.manifest = arg.slice('--manifest='.length);
        } else if (arg === '--playground-url') {
            options.playgroundUrl = argv[index + 1];
            index += 1;
        } else if (arg.startsWith('--playground-url=')) {
            options.playgroundUrl = arg.slice('--playground-url='.length);
        } else {
            throw new Error(`unknown argument: ${arg}`);
        }
    }

    return options;
}

export function resolveFirefoxExecutablePath({
    env = process.env,
    exists = existsSync,
    explicitPath
} = {}) {
    const candidates = [
        explicitPath,
        env.FIREFOX_UAT_BROWSER,
        '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
        '/Applications/Firefox.app/Contents/MacOS/firefox'
    ];

    return (
        candidates.find(
            (candidate) => typeof candidate === 'string' && exists(candidate)
        ) ?? null
    );
}

export function getFirefoxVersion(firefoxExecutablePath) {
    return execFileSync(firefoxExecutablePath, ['--version'], {
        encoding: 'utf8'
    }).trim();
}

export function verifyFirefoxDist({
    cwd = repoRoot,
    manifest = 'packages/devtools-firefox-extension/dist/manifest.json'
} = {}) {
    const manifestPath = resolve(cwd, manifest);
    const distDir = dirname(manifestPath);
    const missing = REQUIRED_FIREFOX_DIST_FILES.filter(
        (file) => !existsSync(join(distDir, file))
    );

    return {
        distDir,
        manifestPath,
        missing,
        ok: missing.length === 0
    };
}

export function createFirefoxUatInstructions({
    firefoxVersion,
    manifestPath,
    playgroundUrl
}) {
    return [
        `Firefox: ${firefoxVersion}`,
        `Temporary add-on manifest: ${manifestPath}`,
        `Playground URL: ${playgroundUrl}`,
        '',
        'Manual UAT steps:',
        `1. In Firefox, open ${DEFAULT_DEBUGGING_URL}.`,
        '2. Click "Load Temporary Add-on".',
        `3. Select ${manifestPath}.`,
        `4. Open ${playgroundUrl}.`,
        '5. Open Firefox DevTools and select the "React" panel.',
        '6. Confirm the live tree renders from the inspected page.',
        '7. Select a component and confirm the state viewer updates.',
        '8. Hover or inspect a component and confirm the page highlight appears.',
        '9. Reload the inspected page and confirm the panel reconnects without stale state.'
    ].join('\n');
}

export function launchFirefoxUat({
    firefoxExecutablePath,
    playgroundUrl,
    spawnProcess = spawn
}) {
    const child = spawnProcess(
        firefoxExecutablePath,
        ['--new-instance', DEFAULT_DEBUGGING_URL, playgroundUrl],
        {
            detached: true,
            stdio: 'ignore'
        }
    );

    child.unref?.();

    return child;
}

export function runCli(argv, { cwd = repoRoot, stdout = console.log } = {}) {
    const options = parseCli(argv);
    const firefoxExecutablePath = resolveFirefoxExecutablePath({
        explicitPath: options.firefox
    });

    if (!firefoxExecutablePath) {
        throw new Error(
            'Firefox was not found. Set FIREFOX_UAT_BROWSER or pass --firefox <path>.'
        );
    }

    const dist = verifyFirefoxDist({ cwd, manifest: options.manifest });

    if (!dist.ok) {
        throw new Error(
            `Firefox extension dist is missing required files: ${dist.missing.join(', ')}`
        );
    }

    const firefoxVersion = getFirefoxVersion(firefoxExecutablePath);
    const instructions = createFirefoxUatInstructions({
        firefoxVersion,
        manifestPath: dist.manifestPath,
        playgroundUrl: options.playgroundUrl
    });

    stdout(instructions);

    if (options.launch) {
        launchFirefoxUat({
            firefoxExecutablePath,
            playgroundUrl: options.playgroundUrl
        });
        stdout('');
        stdout('Firefox UAT surfaces launched.');
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        runCli(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
