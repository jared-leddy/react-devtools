import { reactDevtools } from '@devtools/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), reactDevtools()]
});
