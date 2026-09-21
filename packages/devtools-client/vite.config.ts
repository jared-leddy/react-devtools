import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        cssCodeSplit: false,
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: () => 'devtools-client.js',
            formats: ['es']
        },
        outDir: 'dist/library',
        rollupOptions: {
            external: [
                '@devtools/api',
                '@devtools/kit',
                '@devtools/ui',
                '@devtools/ui/style.css',
                'react',
                'react-dom',
                'react/jsx-runtime',
                'react-router'
            ],
            output: {
                assetFileNames: 'style[extname]'
            }
        }
    },
    plugins: [react()]
});
