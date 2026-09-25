import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        cssCodeSplit: false,
        lib: {
            entry: resolve(__dirname, 'src/main.tsx'),
            name: 'devtoolsOverlay',
            fileName: () => 'devtools-overlay.js',
            formats: ['iife']
        },
        rollupOptions: {
            output: {
                assetFileNames: 'devtools-overlay.[ext]'
            }
        }
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(
            process.env.NODE_ENV ?? 'development'
        )
    },
    plugins: [react()]
});
