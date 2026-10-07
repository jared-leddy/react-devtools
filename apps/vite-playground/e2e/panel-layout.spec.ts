import { expect, test } from '@playwright/test';

test('extension-sized panel keeps navigation, filters, tree, and details usable', async ({
    page
}, testInfo) => {
    await page.goto('/__devtools__/');
    await page.getByRole('link', { name: 'Components', exact: true }).click();
    const tree = page.getByRole('region', { name: 'Component tree' });
    const details = page.getByRole('region', { name: 'Component details' });
    await expect(tree).toBeVisible();
    await expect(details).toBeVisible();
    const layout = await page.evaluate(() => {
        const rect = (selector: string) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Missing critical UI: ${selector}`);
            const bounds = element.getBoundingClientRect();
            return {
                x: bounds.x,
                y: bounds.y,
                right: bounds.right,
                bottom: bounds.bottom,
                width: bounds.width,
                height: bounds.height
            };
        };
        return {
            width: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            header: rect('.dt-client-shell__header'),
            filters: rect('.dt-client-filters'),
            tree: rect('.dt-split-pane__pane--left'),
            details: rect('.dt-split-pane__pane--right')
        };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
    for (const bounds of [
        layout.header,
        layout.filters,
        layout.tree,
        layout.details
    ]) {
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(layout.width + 1);
    }
    expect(layout.header.bottom).toBeLessThanOrEqual(layout.filters.y + 1);
    expect(layout.filters.bottom).toBeLessThanOrEqual(layout.tree.y + 1);
    expect(layout.tree.bottom).toBeLessThanOrEqual(layout.details.y + 1);
    await page
        .getByRole('searchbox', { name: 'Tree filter' })
        .fill('ComponentLeaf0_0');
    await page
        .getByRole('tree', { name: 'Component tree' })
        .getByRole('button', { name: /^ComponentLeaf0_0/ })
        .click();
    await expect(details).toContainText('ComponentLeaf0_0');
    await testInfo.attach('narrow-components', {
        body: await page.screenshot({
            fullPage: true,
            path: testInfo.outputPath('narrow-components.png')
        }),
        contentType: 'image/png'
    });
    for (const label of ['Assets', 'Graph', 'Overview']) {
        await page.getByRole('link', { name: label, exact: true }).click();
        await expect(
            page.getByRole('region', { name: `${label} page` })
        ).toBeVisible();
        if (label === 'Assets') {
            await page
                .getByRole('searchbox', { name: 'Search assets' })
                .fill('devtools-mark.svg');
            await page
                .locator('[aria-label="Asset results"]')
                .getByRole('button')
                .first()
                .click();
            await expect(
                page.getByRole('heading', {
                    name: 'devtools-mark.svg',
                    exact: true
                })
            ).toBeVisible();
        }
        if (label === 'Graph') {
            await page
                .getByRole('searchbox', { name: 'Search modules' })
                .fill('VitePlaygroundApp');
            await page
                .getByRole('img', { name: 'Module dependency graph' })
                .getByRole('button', { name: /VitePlaygroundApp/ })
                .click();
            await expect(
                page.getByRole('heading', {
                    name: 'VitePlaygroundApp.tsx',
                    exact: true
                })
            ).toBeVisible();
        }
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        window.innerWidth
                )
            )
            .toBe(true);
        await testInfo.attach(`narrow-${label.toLowerCase()}`, {
            body: await page.screenshot({
                fullPage: true,
                path: testInfo.outputPath(`narrow-${label.toLowerCase()}.png`)
            }),
            contentType: 'image/png'
        });
    }
});
