import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { browserBoundaryPlugin } from '../../scripts/bundle-checks.mjs';

export default defineConfig({
    base: './',
    build: {
        emptyOutDir: true,
        outDir: 'dist/standalone'
    },
    plugins: [react(), browserBoundaryPlugin()]
});
