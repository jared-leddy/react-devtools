import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        cssCodeSplit: false,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: () => 'devtools-ui.js',
            formats: ['es']
        },
        rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime', 'shiki'],
            output: {
                assetFileNames: 'style[extname]'
            }
        }
    },
    plugins: [react()]
});
