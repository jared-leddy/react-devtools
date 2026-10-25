import assert from 'node:assert/strict';
export async function verifyChromeLifecycles({
    page,
    otherPage,
    context,
    cdp,
    panels,
    extension,
    capture
}) {
    const snapshots = [];
    const a = panels.find((panel) => panel.url === page.url());
    const b = panels.find((panel) => panel.url === otherPage.url());
    assert(a && b, 'Actual native panels for both inspected tabs are required');
    const read = async (panel, action = '') => {
        const reply = await panel.evaluate(
            `(async()=>{${action};await new Promise(r=>setTimeout(r,50));return {body:document.body.innerText,tabId:chrome.devtools.inspectedWindow.tabId,nodes:[...document.querySelectorAll('[data-node-id]')].map(n=>({id:n.dataset.nodeId,label:n.querySelector('.dt-components-tree__label')?.textContent,selected:n.getAttribute('aria-selected')})),values:[...document.querySelectorAll('.dt-state-viewer__value')].map(n=>n.textContent)};})()`
        );
        return reply.result?.result?.value;
    };
    const wait = async (stage, panel, predicate) => {
        let last;
        for (let i = 0; i < 150; i++) {
            last = await read(panel);
            if (last && predicate(last)) {
                snapshots.push({ stage, ...last });
                return last;
            }
        }
        throw Error(
            `${stage}: ${JSON.stringify(last)}; page ${JSON.stringify(await page.evaluate(() => ({ url: window.location.href, backend: !!window[Symbol.for('react-devtools.page-backend')], scripts: [...document.scripts].map((s) => s.src), traffic: window.__r08Rpc })))} `
        );
    };
    const select = async (panel) => {
        await wait('tree-ready', panel, (state) =>
            state.nodes.some((n) => n.label === 'LifecycleApp')
        );
        await read(
            panel,
            `[...document.querySelectorAll('.dt-components-tree__label')].find(n=>n.textContent==='LifecycleApp').closest('button').click()`
        );
    };
    for (const panel of [a, b])
        await read(
            panel,
            `[...document.querySelectorAll('a')].find(n=>n.textContent==='Components').click()`
        );
    const early = await read(a);
    if (new URL(page.url()).searchParams.has('defer')) {
        assert.equal(early.nodes.length, 0);
        await page.locator('#start-app').click();
    }
    await select(a);
    await select(b);
    const initial = await wait('tab-A', a, (s) => s.values.includes('"A"'));
    await wait(
        'tab-B',
        b,
        (s) => s.values.includes('"B"') && !s.values.includes('"A"')
    );
    assert.notEqual(initial.tabId, (await read(b)).tabId);
    assert(!initial.values.includes('"FRAME"'));
    await page.frameLocator('#child').locator('#increment').click();
    await page.locator('#increment').click();
    await wait(
        'independent-frame-and-tab',
        a,
        (s) => s.values.includes('1') && !s.values.includes('"FRAME"')
    );
    assert((await read(b)).values.includes('0'));
    const originalId = (await read(a)).nodes.find(
        (n) => n.label === 'LifecycleApp'
    ).id;
    const version = `v${Date.now()}`;
    await page.request.get(
        `http://127.0.0.1:9057/__r08/update?version=${version}`
    );
    await page
        .locator('#source-version')
        .filter({ hasText: version })
        .waitFor();
    const hot = await wait(
        'actual-vite-fast-refresh',
        a,
        (s) => s.values.includes(`"${version}"`) && s.values.includes('1')
    );
    assert.equal(
        hot.nodes.find((n) => n.label === 'LifecycleApp').id,
        originalId
    );
    for (let i = 0; i < 3; i++) {
        await page.reload();
        if (new URL(page.url()).searchParams.has('defer'))
            await page.locator('#start-app').click();
        await wait(
            `reload-${i}-clears-old-selection`,
            a,
            (s) =>
                s.nodes.some(
                    (n) => n.label === 'LifecycleApp' && n.id !== originalId
                ) && !s.values.includes('"A"')
        );
        await select(a);
        await wait(
            `reload-${i}-fresh`,
            a,
            (s) => s.values.includes('"A"') && s.values.includes('0')
        );
        assert(
            (await page.locator('#__react-devtools-user-app__').count()) <= 1
        );
        assert(
            await page.evaluate(
                () => !!window[Symbol.for('react-devtools.page-backend')]
            )
        );
    }
    const worker = await context.newCDPSession(page);
    const versions = new Map();
    const workerEvents = [];
    worker.on('ServiceWorker.workerVersionUpdated', (event) => {
        workerEvents.push(...event.versions);
        event.versions.forEach((value) => versions.set(value.versionId, value));
    });
    await worker.send('ServiceWorker.enable');
    let owned;
    for (let i = 0; i < 100; i++) {
        owned = [...versions.values()].find(
            (value) =>
                value.scriptURL ===
                    `chrome-extension://${extension.id}/background.js` &&
                value.runningStatus === 'running'
        );
        if (owned) break;
        await page.waitForTimeout(50);
    }
    assert(owned, 'Actual extension worker version not observed');
    const beforeTargets = await cdp.send('Target.getTargets');
    const oldWorker = beforeTargets.targetInfos.find(
        (target) => target.url === owned.scriptURL
    )?.targetId;
    const eventStart = workerEvents.length;
    await worker.send('ServiceWorker.stopWorker', {
        versionId: owned.versionId
    });
    await wait(
        'worker-restart-snapshot',
        a,
        (s) =>
            s.nodes.some((n) => n.label === 'LifecycleApp') &&
            !s.values.includes('"A"')
    );
    await select(a);
    await wait('worker-restart-values', a, (s) => s.values.includes('"A"'));
    await select(b);
    await wait('other-tab-after-worker-restart', b, (s) =>
        s.values.includes('"B"')
    );
    const restartEvents = () =>
        workerEvents
            .slice(eventStart)
            .filter((value) => value.versionId === owned.versionId);
    for (let i = 0; i < 100; i++) {
        if (
            restartEvents().some((v) => v.runningStatus === 'stopped') &&
            restartEvents().some((v) => v.runningStatus === 'running')
        )
            break;
        await page.waitForTimeout(50);
    }
    assert(
        restartEvents().some((v) => v.runningStatus === 'stopped') &&
            restartEvents().some((v) => v.runningStatus === 'running'),
        `Worker execution did not stop and restart: ${JSON.stringify(restartEvents())}`
    );
    await page.locator('#remove-app').click();
    await wait(
        'root-unmount',
        a,
        (s) => s.nodes.length === 0 && s.values.length === 0
    );
    await page.locator('#restore-app').click();
    await select(a);
    await wait('root-remount', a, (s) => s.values.includes('"A"'));
    await capture('recovered');
    const restoreUrl = page.url();
    await page.goto('chrome://version/');
    await wait(
        'restricted-document-clears-values',
        a,
        (s) => s.values.length === 0 && !s.body.includes('"A"')
    );
    const denied = await a.evaluate(
        `new Promise(resolve=>chrome.devtools.inspectedWindow.eval('location.href',(value,exception)=>resolve({value,exception})))`
    );
    const permissionDenial = denied.result?.result?.value;
    assert(
        permissionDenial?.exception?.isError,
        `Browser did not deny inspection: ${JSON.stringify(permissionDenial)}`
    );
    await page.goBack();
    assert.equal(page.url(), restoreUrl);
    if (new URL(restoreUrl).searchParams.has('defer'))
        await page.locator('#start-app').click();
    await select(a);
    await wait('navigation-restored', a, (s) => s.values.includes('"A"'));
    await page.close();
    await otherPage.locator('#increment').click();
    await wait(
        'inspected-tab-closed-other-tab-live',
        b,
        (s) => s.values.includes('"B"') && s.values.includes('1')
    );
    await worker.detach().catch(() => {});
    return {
        early,
        snapshots,
        permissionDenial,
        workerRestart: {
            versionId: owned.versionId,
            oldTargetId: oldWorker,
            events: restartEvents()
        },
        framePolicy:
            'top-document only; child frames cannot replace the inspected document'
    };
}
