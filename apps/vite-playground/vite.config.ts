import { reactDevtools } from '@devtools/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        react(),
        reactDevtools(),
        {
            name: 'playground-overlay-styles',
            apply: 'serve',
            transformIndexHtml: () => [
                {
                    tag: 'link',
                    attrs: {
                        rel: 'stylesheet',
                        href: '/__react-devtools-overlay__/devtools-overlay.css'
                    },
                    injectTo: 'head'
                }
            ]
        }
    ]
});
