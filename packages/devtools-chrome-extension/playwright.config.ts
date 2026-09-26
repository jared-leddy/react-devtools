import { defineConfig } from '@playwright/test';

export default defineConfig({
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    reporter: process.env.CI ? 'dot' : 'list',
    testDir: './e2e',
    timeout: 60_000,
    use: {
        trace: 'retain-on-failure'
    }
});
