import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build } from 'vite';
import {
    browserBoundaryPlugin,
    checkApiDependencies,
    checkBundles,
    forbiddenModule,
    installedManifest,
    measureBundle
} from './bundle-checks.mjs';

function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), 'devtools-bundle-check-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
}
function file(root, path, content) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
    return target;
}
function manifest(root, path, value) {
    return file(root, path, JSON.stringify(value));
}

test('real browser builds fail when a server builtin enters an entry point', async (t) => {
    const root = fixture(t);
    const entry = file(
        root,
        'entry.js',
        'import fs from "node:fs"; console.log(fs);'
    );
    await assert.rejects(
        build({
            configFile: false,
            root,
            logLevel: 'silent',
            plugins: [browserBoundaryPlugin()],
            build: {
                write: false,
                lib: { entry, formats: ['es'], fileName: 'test' }
            }
        }),
        /Browser dependency boundary violation/
    );
});

test('identifies server modules without rejecting browser transport or similarly named packages', () => {
    for (const id of [
        'fs',
        'node:fs/promises',
        '__vite-browser-external:os',
        '/node_modules/vite/dist/node/index.js',
        '\\project\\node_modules\\sirv\\index.js',
        '/project/packages/devtools-vite-plugin/dist/index.js',
        '@devtools/nextjs-plugin'
    ])
        assert.equal(forbiddenModule(id), true, id);
    for (const id of [
        'vite-hot-client',
        '/node_modules/vite-hot-client/dist/index.js',
        'react',
        '/src/fs.ts',
        'vite-like',
        '\0vite/modulepreload-polyfill.js'
    ])
        assert.equal(forbiddenModule(id), false, id);
    assert.equal(forbiddenModule('react/jsx-runtime', true), true);
    assert.equal(forbiddenModule('@devtools/client', true), true);
});

test('build plugin rejects resolved and external modules in the actual module graph', () => {
    const plugin = browserBoundaryPlugin();
    const context = (ids) => ({
        getModuleIds: () => ids.values(),
        error: (message) => {
            throw new Error(message);
        }
    });
    plugin.generateBundle.call(
        context(['/src/main.ts', '/node_modules/react/index.js'])
    );
    assert.throws(
        () =>
            plugin.generateBundle.call(
                context(['\0__vite-browser-external:fs'])
            ),
        /boundary violation/
    );
    assert.throws(
        () => plugin.generateBundle.call(context(['vite'])),
        /boundary violation/
    );
    assert.throws(
        () =>
            browserBoundaryPlugin(true).generateBundle.call(
                context(['/node_modules/react/index.js'])
            ),
        /boundary violation/
    );
});

test('measures all nested JS and CSS once, excluding maps, declarations, and images', (t) => {
    const root = fixture(t);
    file(root, 'main.js', 'export const value = 1;');
    file(root, 'assets/chunk.mjs', 'export default 2;');
    file(root, 'assets/style.css', 'body{}');
    file(root, 'main.js.map', 'ignored');
    file(root, 'types.d.ts', 'ignored');
    const result = measureBundle(root);
    assert.equal(result.files, 3);
    assert.equal(result.rawBytes, 46);
    assert.ok(result.gzipBytes > 0);
    assert.throws(() => measureBundle(join(root, 'missing')), /ENOENT/);
});

test('budgets fail closed for missing output, invalid limits and raw/gzip excess', (t) => {
    const root = fixture(t);
    file(root, 'dist/main.js', 'export default 123;');
    const budget = {
        name: 'test',
        directory: 'dist',
        rawBytes: 100,
        gzipBytes: 100
    };
    assert.equal(checkBundles(root, [budget])[0].files, 1);
    assert.throws(
        () => checkBundles(root, [{ ...budget, rawBytes: 1 }]),
        /exceeds rawBytes/
    );
    assert.throws(
        () => checkBundles(root, [{ ...budget, gzipBytes: 1 }]),
        /exceeds gzipBytes/
    );
    assert.throws(
        () => checkBundles(root, [{ ...budget, rawBytes: 0 }]),
        /Invalid rawBytes/
    );
    assert.throws(
        () => checkBundles(root, [{ ...budget, gzipBytes: -1 }]),
        /Invalid gzipBytes/
    );
    file(root, 'empty/style.css', 'a{}');
    assert.throws(
        () => measureBundle(join(root, 'empty')),
        /Missing JavaScript/
    );
});

test('API checks runtime, optional and peer edges transitively, handle cycles and ignore dev dependencies', (t) => {
    const root = fixture(t);
    manifest(root, 'packages/devtools-api/package.json', {
        dependencies: { kit: '*' },
        devDependencies: { react: '*' }
    });
    const kit = manifest(root, 'kit.json', {
        optionalDependencies: { transport: '*' }
    });
    const transport = manifest(root, 'transport.json', {
        peerDependencies: { kit: '*' }
    });
    const paths = { kit, transport };
    assert.equal(
        checkApiDependencies(root, (name) => paths[name]),
        3
    );
    manifest(root, 'transport.json', { dependencies: { 'react-dom': '*' } });
    assert.throws(
        () => checkApiDependencies(root, (name) => paths[name]),
        /@devtools\/api -> kit -> transport -> react-dom/
    );
    manifest(root, 'transport.json', { dependencies: { vite: '*' } });
    assert.throws(
        () => checkApiDependencies(root, (name) => paths[name]),
        /boundary violation/
    );
});

test('resolves installed package manifests even when package.json is not exported', (t) => {
    const root = fixture(t);
    const from = manifest(root, 'package.json', {});
    const target = manifest(root, 'node_modules/transport/package.json', {
        exports: './index.js'
    });
    assert.equal(installedManifest('transport', from), target);
    assert.throws(
        () => installedManifest('nonexistent-devtools-package', from),
        /Cannot resolve/
    );
});

test('allows only the existing browser transport host peer, never its runtime edge', (t) => {
    const root = fixture(t);
    manifest(root, 'packages/devtools-api/package.json', {
        dependencies: { 'vite-hot-client': '*' }
    });
    const transport = manifest(root, 'transport.json', {
        name: 'vite-hot-client',
        peerDependencies: { vite: '*' }
    });
    assert.equal(
        checkApiDependencies(root, () => transport),
        2
    );
    manifest(root, 'transport.json', {
        name: 'vite-hot-client',
        dependencies: { vite: '*' },
        peerDependencies: { vite: '*' }
    });
    assert.throws(
        () => checkApiDependencies(root, () => transport),
        /boundary violation/
    );
    manifest(root, 'transport.json', {
        name: 'vite-hot-client',
        optionalDependencies: { vite: '*' },
        peerDependencies: { vite: '*' }
    });
    assert.throws(
        () => checkApiDependencies(root, () => transport),
        /boundary violation/
    );
    assert.equal(forbiddenModule('\0vite/preload-helper.js'), false);
    assert.equal(forbiddenModule('vite/preload-helper.js'), true);
});
