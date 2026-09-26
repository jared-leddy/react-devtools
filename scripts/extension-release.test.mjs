import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import {
    createArtifactName,
    getExtensionTargets,
    packageExtensions,
    parseCli,
    updateExtensionVersions,
    validateVersion
} from './extension-release.mjs';

test('parses release helper commands and flags', () => {
    assert.deepEqual(
        parseCli([
            'prepare',
            '--version',
            '1.2.3',
            '--target=firefox',
            '--out-dir',
            'artifacts',
            '--dry-run'
        ]),
        {
            command: 'prepare',
            options: {
                dryRun: true,
                outDir: 'artifacts',
                skipBuild: false,
                target: 'firefox',
                version: '1.2.3'
            }
        }
    );
});

test('validates explicit extension targets and versions', () => {
    assert.deepEqual(getExtensionTargets('all'), ['chrome', 'firefox']);
    assert.deepEqual(getExtensionTargets('chrome'), ['chrome']);
    assert.doesNotThrow(() => validateVersion('1.2.3-beta.1'));
    assert.throws(() => getExtensionTargets('safari'), /unknown --target/);
    assert.throws(() => validateVersion('next'), /invalid --version/);
});

test('uses stable artifact names with target and version', () => {
    assert.equal(
        createArtifactName('firefox', '1.2.3'),
        'react-devtools-firefox-extension-v1.2.3.zip'
    );
});

test('dry-run version updates report changes without writing files', () => {
    const root = join(
        tmpdir(),
        `react-devtools-extension-release-${Date.now()}`
    );

    for (const target of ['chrome', 'firefox']) {
        const base = join(root, `packages/devtools-${target}-extension`);
        mkdirSync(join(base, 'public'), { recursive: true });
        mkdirSync(join(base, 'src'), { recursive: true });
        writeFileSync(
            join(base, 'package.json'),
            JSON.stringify({ name: target, version: '0.0.1' }, null, 4) + '\n'
        );
        writeFileSync(
            join(base, 'public/manifest.json'),
            JSON.stringify({ version: '0.0.1' }, null, 4) + '\n'
        );
        writeFileSync(join(base, 'src/smoke.tsx'), "version: '0.0.1'\n");
    }

    const messages = [];
    updateExtensionVersions({
        cwd: root,
        dryRun: true,
        stdout: (message) => messages.push(message),
        targets: ['chrome'],
        version: '0.0.2'
    });

    assert.equal(
        JSON.parse(
            readFileSync(
                join(root, 'packages/devtools-chrome-extension/package.json'),
                'utf8'
            )
        ).version,
        '0.0.1'
    );
    assert.equal(messages.length, 3);
    assert.match(messages[0], /would update/);
});

test('prepare dry-run package preview can use the requested release version', () => {
    const root = join(
        tmpdir(),
        `react-devtools-extension-package-${Date.now()}`
    );
    const base = join(root, 'packages/devtools-chrome-extension');
    mkdirSync(join(base, 'public'), { recursive: true });
    writeFileSync(
        join(base, 'package.json'),
        JSON.stringify({ name: '@devtools/chrome-extension', version: '0.0.1' })
    );
    writeFileSync(
        join(base, 'public/manifest.json'),
        JSON.stringify({ version: '0.0.1' })
    );

    const artifacts = packageExtensions({
        cwd: root,
        dryRun: true,
        stdout: () => undefined,
        targets: ['chrome'],
        versionOverride: '0.0.2'
    });

    assert.equal(artifacts[0].version, '0.0.2');
    assert.match(artifacts[0].path, /v0\.0\.2\.zip$/);
});
