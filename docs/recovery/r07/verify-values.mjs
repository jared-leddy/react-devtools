import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const output = process.argv[2] ?? 'artifacts/r07-values-smoke';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const observations = [];
try {
    for (const mode of ['development', 'production'])
        for (const host of ['overlay', 'standalone']) {
            const context = await browser.newContext({
                viewport: { width: 1440, height: 1000 }
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`http://127.0.0.1:9056/${mode}?overlay`);
            await page
                .getByRole('button', { name: 'Toggle React DevTools panel' })
                .click();
            let client = page.frameLocator('iframe[title="React DevTools"]');
            let standalone;
            if (host === 'standalone') {
                [standalone] = await Promise.all([
                    context.waitForEvent('page'),
                    page
                        .getByRole('link', {
                            name: 'Open React DevTools in separate window'
                        })
                        .click()
                ]);
                client = standalone;
            }
            await client
                .getByRole('link', { name: 'Components', exact: true })
                .click();
            // Select the real named component through its visible tree button.
            const selectNamed = async (name) => {
                await client
                    .getByLabel('Tree filter', { exact: true })
                    .fill(name);
                await client
                    .locator('.dt-components-tree__node')
                    .filter({ hasText: name })
                    .click();
            };
            await selectNamed('InspectorFunction');
            await client.getByText('"R07 props 0"', { exact: true }).waitFor();
            await client
                .getByRole('heading', { name: 'Context', exact: true })
                .waitFor();
            await client.getByText('"light"', { exact: true }).waitFor();
            assert(
                (await client.locator('.dt-state-viewer').innerText()).includes(
                    'Unavailable'
                )
            );
            assert(
                (await client.locator('.dt-state-viewer').innerText()).includes(
                    'Truncated'
                )
            );
            await page.locator('#function-update').click();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^6$/ })
                .waitFor();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^3$/ })
                .waitFor();
            await page.locator('#update-app').click();
            await client.getByText('"R07 props 1"', { exact: true }).waitFor();
            await client.getByText('"dark"', { exact: true }).waitFor();
            const functionBody = await client
                .locator('.dt-state-viewer')
                .innerText();
            await (standalone ?? page).screenshot({
                path: `${output}/${host}-${mode}-function.png`,
                fullPage: true
            });
            await selectNamed('InspectorClass');
            await client.getByText('"class-prop"', { exact: true }).waitFor();
            await client
                .getByRole('heading', { name: 'Class State', exact: true })
                .waitFor();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^10$/ })
                .waitFor();
            await page.locator('#class-update').click();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^11$/ })
                .waitFor();
            const classBody = await client
                .locator('.dt-state-viewer')
                .innerText();
            assert(!classBody.includes('Hook 0'));
            await (standalone ?? page).screenshot({
                path: `${output}/${host}-${mode}-class.png`,
                fullPage: true
            });
            await page.locator('#remove-app').click();
            await client
                .getByText('Empty React root', { exact: true })
                .waitFor();
            assert.deepEqual(errors, []);
            observations.push({ mode, host, functionBody, classBody, errors });
            await context.close();
        }
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify({ browser: browser.version(), observations }, null, 4)
    );
    console.log(`Verified ${observations.length} real value scenarios`);
} finally {
    await browser.close();
}
