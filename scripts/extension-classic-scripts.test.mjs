import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Script, createContext } from 'node:vm';
import { extensionClassicScripts } from './extension-classic-scripts.mjs';

test('emits standalone classic scripts with isolated lexical bindings', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'classic-scripts-'));
    try {
        const shared = join(directory, 'shared.js');
        const prepare = join(directory, 'prepare.js');
        const detector = join(directory, 'detector.js');
        writeFileSync(shared, 'export const value = 7;');
        writeFileSync(
            prepare,
            'import {value} from "./shared.js"; const collision=value; globalThis.first=collision;'
        );
        writeFileSync(
            detector,
            'import {value} from "./shared.js"; const collision=value+1; globalThis.second=collision;'
        );
        const emitted = [];
        await extensionClassicScripts({
            prepare,
            detector
        }).generateBundle.call({ emitFile: (file) => emitted.push(file) });
        assert.deepEqual(
            emitted.map((file) => file.fileName),
            ['prepare.js', 'detector.js']
        );
        const context = createContext({});
        emitted.forEach((file) => {
            assert.equal(file.type, 'asset');
            new Script(file.source).runInContext(context);
        });
        assert.equal(context.first, 7);
        assert.equal(context.second, 8);
        new Script(emitted[0].source).runInContext(context);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('fails the build when a classic entry is missing', async () => {
    await assert.rejects(
        extensionClassicScripts({
            missing: '/does-not-exist/r03-entry.ts'
        }).generateBundle.call({
            emitFile() {
                throw new Error('Must not emit');
            }
        })
    );
});
