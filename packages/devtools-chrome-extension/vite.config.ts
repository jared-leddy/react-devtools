import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'src/index.ts'),
                popup: resolve(__dirname, 'popup.html')
            },
            output: {
                entryFileNames: '[name].js'
            }
        }
    },
    plugins: [react()]
});
