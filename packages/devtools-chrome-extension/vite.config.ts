import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background.ts'),
                detector: resolve(__dirname, 'src/content/detector.ts'),
                devtools: resolve(__dirname, 'devtools.html'),
                devtoolsPanel: resolve(__dirname, 'devtools-panel.html'),
                index: resolve(__dirname, 'src/index.ts'),
                prepare: resolve(__dirname, 'src/content/prepare.ts'),
                popup: resolve(__dirname, 'popup.html'),
                proxy: resolve(__dirname, 'src/content/proxy.ts'),
                smoke: resolve(__dirname, 'smoke.html')
            },
            output: {
                entryFileNames: '[name].js'
            }
        }
    },
    plugins: [react()]
});
