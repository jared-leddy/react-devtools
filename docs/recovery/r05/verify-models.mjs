import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const output = process.argv[2] ?? '/private/tmp/r05-models';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const observations = [];
try {
    for (const mode of ['development', 'production', 'empty', 'non-react']) {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 }
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:9054/${mode}?overlay`);
        assert.equal(
            await page
                .locator(
                    '[data-react-devtools-component-id], [data-react-devtools-source]'
                )
                .count(),
            0
        );
        await page
            .getByRole('button', { name: 'Toggle React DevTools panel' })
            .click();
        const client = page.frameLocator('iframe[title="React DevTools"]');
        await client
            .getByRole('link', { name: 'Components', exact: true })
            .click();
        if (mode === 'empty')
            await client
                .getByText('Empty React root', { exact: true })
                .waitFor();
        else if (mode === 'non-react')
            await client
                .getByRole('heading', { name: 'No React detected' })
                .waitFor();
        else {
            await client
                .getByText('"R05 observed prop"', { exact: true })
                .waitFor();
            await page.locator('#increment').click();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^1$/ })
                .waitFor();
        }
        const body = await client.locator('body').innerText();
        assert(!/ComponentGroup|ComponentLeaf|12\.4 ms|root:app/.test(body));
        await page.screenshot({
            path: `${output}/overlay-${mode}.png`,
            fullPage: true
        });
        const [standalone] = await Promise.all([
            context.waitForEvent('page'),
            page
                .getByRole('link', {
                    name: 'Open React DevTools in separate window'
                })
                .click()
        ]);
        await standalone
            .getByRole('link', { name: 'Components', exact: true })
            .click();
        if (mode === 'empty')
            await standalone
                .getByText('Empty React root', { exact: true })
                .waitFor();
        else if (mode === 'non-react')
            await standalone
                .getByRole('heading', { name: 'No React detected' })
                .waitFor();
        else {
            await standalone
                .getByText('"R05 observed prop"', { exact: true })
                .waitFor();
            await standalone
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^1$/ })
                .waitFor();
            await page.locator('#increment').click();
            await standalone
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^2$/ })
                .waitFor();
            await client
                .locator('.dt-state-viewer__value--number')
                .filter({ hasText: /^2$/ })
                .waitFor();
        }
        const standaloneBody = await standalone.locator('body').innerText();
        assert(
            !/ComponentGroup|ComponentLeaf|12\.4 ms|root:app/.test(
                standaloneBody
            )
        );
        await standalone.screenshot({
            path: `${output}/standalone-${mode}.png`,
            fullPage: true
        });
        observations.push({
            mode,
            url: page.url(),
            standaloneUrl: standalone.url(),
            overlay: body,
            standalone: standaloneBody,
            errors
        });
        assert.deepEqual(errors, []);
        await context.close();
    }
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify({ browser: browser.version(), observations }, null, 4)
    );
    console.log(
        `Verified ${observations.length} unannotated fixture modes in both overlay and standalone`
    );
} finally {
    await browser.close();
}
