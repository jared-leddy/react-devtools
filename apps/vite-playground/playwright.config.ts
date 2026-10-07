import { defineConfig } from '@playwright/test';

const port = 9032;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './e2e',
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL,
        browserName: 'chromium',
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    projects: [
        {
            name: 'desktop',
            testMatch: 'product.smoke.spec.ts',
            use: { viewport: { width: 1280, height: 900 } }
        },
        ...[360, 420].map((width) => ({
            name: `panel-${width}`,
            testMatch: 'panel-layout.spec.ts',
            use: { viewport: { width, height: 720 } }
        }))
    ],
    webServer: {
        command: `npm run start:dev -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000
    }
});
