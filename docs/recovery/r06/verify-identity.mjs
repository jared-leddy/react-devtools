import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const output = process.argv[2] ?? 'artifacts/r06-identity-smoke';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const observations = [];
async function eventually(check) {
    let last;
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            return await check();
        } catch (error) {
            last = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw last;
}
try {
    for (const mode of ['development', 'production']) {
        for (const host of ['overlay', 'standalone']) {
            const context = await browser.newContext({
                viewport: { width: 1440, height: 1000 }
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`http://127.0.0.1:9055/${mode}?overlay`);
            assert.equal(
                await page
                    .locator('[data-react-devtools-component-id]')
                    .count(),
                0
            );
            await page
                .getByRole('button', { name: 'Toggle React DevTools panel' })
                .click();
            let client = page.frameLocator('iframe[title="React DevTools"]');
            let clientPage;
            if (host === 'standalone') {
                [clientPage] = await Promise.all([
                    context.waitForEvent('page'),
                    page
                        .getByRole('link', {
                            name: 'Open React DevTools in separate window'
                        })
                        .click()
                ]);
                client = clientPage;
            }
            await client
                .getByRole('link', { name: 'Components', exact: true })
                .click();
            const filter = client.getByLabel('Tree filter', { exact: true });
            const expectedNames = await page.evaluate(
                () => window.__r06ExpectedNames
            );
            for (const name of expectedNames) {
                await filter.fill(name);
                await eventually(async () =>
                    assert(
                        (
                            await client
                                .locator('.dt-components-tree')
                                .innerText()
                        ).includes(name),
                        `Missing available label ${name}`
                    )
                );
            }
            await filter.fill('Row');
            const row = client.locator('[data-component-key="b"]');
            await row.waitFor();
            const originalId = await row.getAttribute('data-node-id');
            const rootId = await row.getAttribute('data-root-id');
            assert.match(originalId, /^c:[0-9a-f-]{36}:[0-9a-z]+$/);
            await row.click();
            await client.getByText('"b"', { exact: true }).waitFor();
            await page.locator('#increment-b').click();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^1$/ })
                .waitFor();
            await page.locator('#reorder').click();
            await eventually(async () => {
                assert.equal(
                    await row.getAttribute('data-node-id'),
                    originalId
                );
                assert.equal(await row.getAttribute('data-root-id'), rootId);
                assert.equal(await row.getAttribute('aria-selected'), 'true');
                assert.equal(
                    await page
                        .locator('[data-row]')
                        .first()
                        .getAttribute('data-row'),
                    'b'
                );
            });
            await page.locator('#rename').click();
            await eventually(async () =>
                assert((await row.innerText()).includes('RenamedRow'))
            );
            assert.equal(await row.getAttribute('data-node-id'), originalId);
            await page.locator('#remove-secondary').click();
            await eventually(async () =>
                assert.equal(await row.getAttribute('aria-selected'), 'true')
            );
            await page.locator('#resolve-lazy').click();
            await page.locator('#pending-lazy').waitFor({ state: 'detached' });
            await page.locator('#remove-b').click();
            await row.waitFor({ state: 'detached' });
            await client
                .getByText('No component selected', { exact: true })
                .waitFor();
            await page.locator('#restore-b').click();
            await row.waitFor();
            const remountedId = await row.getAttribute('data-node-id');
            assert.notEqual(remountedId, originalId);
            await client
                .getByText('No component selected', { exact: true })
                .waitFor();
            await row.click();
            await client.getByText('"b"', { exact: true }).waitFor();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^0$/ })
                .waitFor();
            await page.locator('#restore-secondary').click();
            await page.locator('#remove-primary').click();
            await row.waitFor({ state: 'detached' });
            await client
                .getByText('No component selected', { exact: true })
                .waitFor();
            await page.locator('#restore-primary').click();
            await row.waitFor();
            const restoredRootId = await row.getAttribute('data-root-id');
            assert.notEqual(
                await row.getAttribute('data-node-id'),
                remountedId
            );
            assert.notEqual(restoredRootId, rootId);
            await client
                .getByText('No component selected', { exact: true })
                .waitFor();
            await row.click();
            await client.getByText('"b"', { exact: true }).waitFor();
            await (clientPage ?? page).screenshot({
                path: `${output}/${host}-${mode}.png`,
                fullPage: true
            });
            assert.deepEqual(errors, []);
            observations.push({
                mode,
                host,
                expectedNames,
                originalId,
                remountedId,
                rootId,
                restoredRootId,
                errors
            });
            await context.close();
        }
    }
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify({ browser: browser.version(), observations }, null, 4)
    );
    console.log(`Verified ${observations.length} real identity scenarios`);
} finally {
    await browser.close();
}
