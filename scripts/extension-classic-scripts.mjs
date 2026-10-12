import { build } from 'esbuild';

// Manifest content scripts and page-injected scripts cannot load ESM chunks.
export function extensionClassicScripts(entries) {
    return {
        name: 'extension-classic-scripts',
        async generateBundle() {
            for (const [name, entry] of Object.entries(entries)) {
                const result = await build({
                    entryPoints: [entry],
                    bundle: true,
                    format: 'iife',
                    platform: 'browser',
                    target: 'es2022',
                    minify: true,
                    logLevel: 'silent',
                    write: false
                });
                this.emitFile({
                    type: 'asset',
                    fileName: `${name}.js`,
                    source: result.outputFiles[0].text
                });
            }
        }
    };
}
