import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { browserBoundaryPlugin } from '../../scripts/bundle-checks.mjs';

export default defineConfig({
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background.ts'),
                detector: resolve(
                    __dirname,
                    '../devtools-chrome-extension/src/content/detector.ts'
                ),
                devtoolsPanel: resolve(__dirname, 'devtools-panel.html'),
                devtools: resolve(__dirname, 'devtools.html'),
                index: resolve(__dirname, 'src/index.ts'),
                prepare: resolve(
                    __dirname,
                    '../devtools-chrome-extension/src/content/prepare.ts'
                ),
                'prepare-loader': resolve(
                    __dirname,
                    'src/content/prepare-loader.ts'
                ),
                popup: resolve(__dirname, 'popup.html'),
                proxy: resolve(__dirname, 'src/content/proxy.ts'),
                smoke: resolve(__dirname, 'smoke.html'),
                'user-app': resolve(
                    __dirname,
                    '../devtools-chrome-extension/src/content/user-app.ts'
                )
            },
            output: {
                entryFileNames: '[name].js'
            }
        }
    },
    plugins: [react(), browserBoundaryPlugin()]
});
