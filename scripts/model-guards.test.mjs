import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function scripts(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const file = path.join(directory, entry.name);
            return entry.isDirectory()
                ? scripts(file)
                : entry.name.endsWith('.js')
                  ? [file]
                  : [];
        });
}

test('shipped hosts do not contain demo trees or fabricated runtime facts', () => {
    for (const directory of [
        'packages/devtools-client/dist/library',
        'packages/devtools-client/dist/standalone',
        'packages/devtools-overlay/dist',
        'packages/devtools-chrome-extension/dist',
        'packages/devtools-firefox-extension/dist'
    ]) {
        const files = scripts(directory);
        assert(files.length > 0, `Missing build: ${directory}`);
        for (const file of files)
            assert(
                !/ComponentGroup|ComponentLeaf|synthetic-root|12\.4 ms|root:app/.test(
                    fs.readFileSync(file, 'utf8')
                ),
                `Production fixture in ${file}`
            );
    }
});

test('client component authority is the session, never parent-document polling', () => {
    const app = fs.readFileSync('packages/devtools-client/src/App.tsx', 'utf8');
    assert(
        !/window\.parent\.document|generateSyntheticComponentTree|useLiveParentComponentTree/.test(
            app
        )
    );
    const overview = fs.readFileSync(
        'packages/devtools-client/src/overview.ts',
        'utf8'
    );
    assert(!/18\.3\.1|12\.4 ms|root:app/.test(overview));
    assert(overview.includes('visibleRouteCount: null'));
});
