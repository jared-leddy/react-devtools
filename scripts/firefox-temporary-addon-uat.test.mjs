import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    createFirefoxUatInstructions,
    parseCli,
    resolveFirefoxExecutablePath,
    verifyFirefoxDist
} from './firefox-temporary-addon-uat.mjs';

test('parses Firefox UAT helper flags', () => {
    assert.deepEqual(
        parseCli([
            '--no-launch',
            '--firefox=/Applications/Firefox.app/Contents/MacOS/firefox',
            '--manifest',
            'dist/manifest.json',
            '--playground-url=http://localhost:9020/app-demo'
        ]),
        {
            firefox: '/Applications/Firefox.app/Contents/MacOS/firefox',
            launch: false,
            manifest: 'dist/manifest.json',
            playgroundUrl: 'http://localhost:9020/app-demo'
        }
    );
    assert.throws(() => parseCli(['--wat']), /unknown argument/);
});

test('resolves explicit Firefox path before environment and defaults', () => {
    assert.equal(
        resolveFirefoxExecutablePath({
            env: {
                FIREFOX_UAT_BROWSER: '/env/firefox'
            },
            exists: (path) => path === '/explicit/firefox',
            explicitPath: '/explicit/firefox'
        }),
        '/explicit/firefox'
    );
});

test('verifies required Firefox extension dist files', () => {
    const root = join(tmpdir(), `react-devtools-firefox-uat-${Date.now()}`);
    const dist = join(root, 'packages/devtools-firefox-extension/dist');
    const files = [
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
        'prepareLoader.js',
        'proxy.js',
        'smoke.html',
        'smoke.js',
        'user-app.js'
    ];

    mkdirSync(dist, { recursive: true });

    for (const file of files) {
        writeFileSync(join(dist, file), file);
    }

    assert.deepEqual(verifyFirefoxDist({ cwd: root }).missing, []);
    assert.equal(verifyFirefoxDist({ cwd: root }).ok, true);
});

test('prints the Firefox UAT evidence checklist', () => {
    const instructions = createFirefoxUatInstructions({
        firefoxVersion: 'Mozilla Firefox 157.0b4',
        manifestPath:
            '/repo/packages/devtools-firefox-extension/dist/manifest.json',
        playgroundUrl: 'http://localhost:3000/app-demo'
    });

    assert.match(instructions, /Mozilla Firefox 157\.0b4/);
    assert.match(instructions, /Load Temporary Add-on/);
    assert.match(instructions, /state viewer updates/);
    assert.match(instructions, /panel reconnects/);
});
