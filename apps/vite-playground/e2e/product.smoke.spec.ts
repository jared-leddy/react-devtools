import { expect, test, type Page, type TestInfo } from '@playwright/test';

let browserErrors: string[];
test.beforeEach(async ({ page }) => {
    browserErrors = [];
    page.on('pageerror', (error) => {
        browserErrors.push(error.message);
    });
});
test.afterEach(() => {
    expect(browserErrors, 'Uncaught browser errors').toEqual([]);
});

async function openPanel(page: Page) {
    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: 'React DevTools Vite Playground' })
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Toggle React DevTools panel' })
        .click();
    const client = page.frameLocator('iframe[title="React DevTools"]');
    await expect(
        client.getByRole('main', { name: 'React DevTools client' })
    ).toBeVisible();
    return client;
}

async function capturePanel(page: Page, testInfo: TestInfo) {
    await testInfo.attach('product-panel', {
        body: await page
            .getByTestId('react-devtools-frame')
            .screenshot({ path: testInfo.outputPath('product-panel.png') }),
        contentType: 'image/png'
    });
}

test('overlay opens, closes, and reopens with the keyboard shortcut', async ({
    page
}, testInfo) => {
    await openPanel(page);
    await capturePanel(page, testInfo);
    await page
        .getByRole('button', { name: 'Close React DevTools panel' })
        .click();
    await expect(page.locator('iframe[title="React DevTools"]')).toBeHidden();
    await expect(
        page.getByRole('button', { name: 'Toggle React DevTools panel' })
    ).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Alt+Shift+d');
    await expect(
        page
            .frameLocator('iframe[title="React DevTools"]')
            .getByRole('main', { name: 'React DevTools client' })
    ).toBeVisible();
});

test('connection overview and component tree reflect the inspected page', async ({
    page
}, testInfo) => {
    const client = await openPanel(page);
    await client.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(
        client.getByRole('region', { name: 'Overview page' })
    ).toContainText('Connected');
    await expect(
        client.getByRole('region', { name: 'Overview page' })
    ).toContainText('Vite');
    await client.getByRole('link', { name: 'Components', exact: true }).click();
    await expect(
        client.getByRole('tree', { name: 'Component tree' })
    ).toContainText('state-count');
    await expect(
        client.getByRole('tree', { name: 'Component tree' })
    ).not.toContainText('ComponentGroup');
    await capturePanel(page, testInfo);
});

test('component selection updates details and live page state', async ({
    page
}, testInfo) => {
    const client = await openPanel(page);
    await client.getByRole('link', { name: 'Components', exact: true }).click();
    const node = client
        .getByRole('tree', { name: 'Component tree' })
        .getByRole('button', { name: /^strong.*state-count/ })
        .first();
    await node.click();
    const details = client.getByRole('region', { name: 'Component details' });
    await expect(details).toContainText('state-count');
    await expect(details).toContainText('PlainReactDemos.tsx');
    const counter = page.getByRole('article').filter({
        has: page.getByRole('heading', {
            name: 'useState component',
            exact: true
        })
    });
    await counter
        .getByRole('button', { name: 'Increment', exact: true })
        .click();
    await expect(page.getByTestId('state-count')).toHaveText('1');
    await expect(details).toContainText('"1"');
    await capturePanel(page, testInfo);
});

test('inspect mode selects a page component and exits inspect mode', async ({
    page
}, testInfo) => {
    const client = await openPanel(page);
    await page.getByRole('button', { name: 'Toggle inspect mode' }).click();
    await expect(
        page.getByRole('button', { name: 'Toggle inspect mode' })
    ).toHaveAttribute('aria-pressed', 'true');
    const target = page.getByRole('heading', {
        name: 'useState component',
        exact: true
    });
    await target.hover();
    await expect(page.getByTestId('react-devtools-inspect-box')).toBeVisible();
    await target.click();
    await expect(
        page.getByRole('button', { name: 'Toggle inspect mode' })
    ).toHaveAttribute('aria-pressed', 'false');
    const details = client.getByRole('region', { name: 'Component details' });
    await expect(details).toContainText('PlainReactDemos.tsx');
    await expect(details).toContainText('useState component');
    await capturePanel(page, testInfo);
});

test('assets tab loads real project assets and renders the image preview', async ({
    page
}, testInfo) => {
    const client = await openPanel(page);
    await client.getByRole('link', { name: 'Assets', exact: true }).click();
    await client
        .getByRole('searchbox', { name: 'Search assets' })
        .fill('devtools-mark.svg');
    await client
        .locator('[aria-label="Asset results"]')
        .getByRole('button')
        .first()
        .click();
    await expect(
        client.getByRole('heading', { name: 'devtools-mark.svg', exact: true })
    ).toBeVisible();
    const preview = client.locator('.dt-assets-preview__surface img');
    await expect(preview).toBeVisible();
    await expect
        .poll(() =>
            preview.evaluate((image: HTMLImageElement) => image.naturalWidth)
        )
        .toBeGreaterThan(0);
    await capturePanel(page, testInfo);
});

test('graph tab loads real Vite modules and module relationships', async ({
    page
}, testInfo) => {
    const client = await openPanel(page);
    await client.getByRole('link', { name: 'Graph', exact: true }).click();
    await client
        .getByRole('searchbox', { name: 'Search modules' })
        .fill('VitePlaygroundApp');
    const graph = client.getByRole('img', { name: 'Module dependency graph' });
    await expect(graph).toBeVisible();
    await graph.getByRole('button', { name: /VitePlaygroundApp/ }).click();
    await expect(
        client.getByRole('heading', {
            name: 'VitePlaygroundApp.tsx',
            exact: true
        })
    ).toBeVisible();
    await expect(
        client
            .locator('.dt-graph-relations')
            .getByText('Dependencies', { exact: true })
    ).toBeVisible();
    await expect(client.locator('.dt-graph-relations').first()).toContainText(
        'PlainReactDemos.tsx'
    );
    await capturePanel(page, testInfo);
});
