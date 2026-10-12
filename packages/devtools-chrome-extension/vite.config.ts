import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { browserBoundaryPlugin } from '../../scripts/bundle-checks.mjs';
import { extensionClassicScripts } from '../../scripts/extension-classic-scripts.mjs';

export default defineConfig({
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background.ts'),
                devtools: resolve(__dirname, 'devtools.html'),
                devtoolsPanel: resolve(__dirname, 'devtools-panel.html'),
                index: resolve(__dirname, 'src/index.ts'),
                popup: resolve(__dirname, 'popup.html'),
                smoke: resolve(__dirname, 'smoke.html')
            },
            output: {
                entryFileNames: '[name].js'
            }
        }
    },
    plugins: [
        react(),
        browserBoundaryPlugin(),
        extensionClassicScripts({
            detector: resolve(__dirname, 'src/content/detector.ts'),
            prepare: resolve(__dirname, 'src/content/prepare.ts'),
            proxy: resolve(__dirname, 'src/content/proxy.ts'),
            'user-app': resolve(__dirname, 'src/content/user-app.ts')
        })
    ]
});
