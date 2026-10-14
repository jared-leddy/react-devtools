import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) throw new Error('Provide an inspected fixture URL');
const output = process.argv[3] ?? '/private/tmp/r03-chrome';
fs.mkdirSync(output, { recursive: true });
const context = await chromium.launchPersistentContext(
    fs.mkdtempSync('/private/tmp/r03-chrome-profile-'),
    {
        executablePath:
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [
            '--enable-unsafe-extension-debugging',
            '--auto-open-devtools-for-tabs',
            '--remote-debugging-port=9351'
        ],
        viewport: { width: 1600, height: 1100 }
    }
);
const sockets = [];
const updateMode = process.argv.includes('--updates');
const nativeInspectors = [];
try {
    const cdp = await context.browser().newBrowserCDPSession();
    const browser = await cdp.send('Browser.getVersion');
    const extension = await cdp.send('Extensions.loadUnpacked', {
        path: new URL(
            '../packages/devtools-chrome-extension/dist',
            import.meta.url
        ).pathname
    });
    const page = await context.newPage();
    if (updateMode)
        await page.addInitScript(() => {
            window.__r04Traffic = { updates: [], disconnects: 0 };
            window.addEventListener('message', (event) => {
                if (
                    event.data?.event ===
                    '__react-devtools-extension-disconnect__'
                )
                    window.__r04Traffic.disconnects++;
                const rpc = event.data?.payload?.json;
                if (
                    event.data?.source === 'react-devtools:server-to-proxy' &&
                    rpc?.m === 'notifySessionUpdated'
                ) {
                    const update = rpc.a?.[0];
                    window.__r04Traffic.updates.push({
                        sessionId: update?.sessionId,
                        streamId: update?.streamId,
                        revision: update?.revision,
                        baseRevision: update?.baseRevision,
                        fields: Object.keys(update?.patch ?? {})
                    });
                }
            });
        });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(url);
    await page.waitForTimeout(3000);
    const discovery = await fetch('http://127.0.0.1:9351/json/list').then((r) =>
        r.json()
    );
    for (const target of discovery.filter((t) =>
        t.url.startsWith('devtools://')
    )) {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        sockets.push(ws);
        await new Promise((r) =>
            ws.addEventListener('open', r, { once: true })
        );
        let next = 0;
        const pending = new Map();
        ws.addEventListener('message', (event) => {
            const m = JSON.parse(event.data);
            if (m.id) {
                pending.get(m.id)?.(m);
                pending.delete(m.id);
            }
        });
        const send = (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++next;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Native CDP timeout: ${method}`));
                }, 15000);
                pending.set(id, (message) => {
                    clearTimeout(timer);
                    resolve(message);
                });
                ws.send(JSON.stringify({ id, method, params }));
            });
        const tabs = await send('Runtime.evaluate', {
            expression:
                '(() => {const roots=[document];const tabs=[];for(let i=0;i<roots.length;i++)for(const e of roots[i].querySelectorAll("*")){if(e.shadowRoot)roots.push(e.shadowRoot);if(e.getAttribute("role")==="tab")tabs.push({id:e.id,text:e.textContent});}return tabs;})()',
            returnByValue: true
        });
        console.log('Tabs', tabs.result?.result?.value);
        const inventory = await send('Runtime.evaluate', {
            expression:
                '(async () => {const UI=await import("./ui/legacy/legacy.js");const pane=UI.InspectorView.InspectorView.instance().tabbedPane;return {ids:pane.tabIds(),keys:Object.keys(pane),tabs:pane.tabs?.map(t=>({id:t.id,title:t.title}))};})()',
            awaitPromise: true,
            returnByValue: true
        });
        console.log(
            'Registered native panels',
            inventory.result?.result?.value,
            inventory.result?.exceptionDetails
        );
        const react = inventory.result?.result?.value?.tabs?.find(
            (item) => item.title === 'React'
        );
        if (react)
            await send('Runtime.evaluate', {
                expression: `(async()=>{const UI=await import("./ui/legacy/legacy.js");await UI.InspectorView.InspectorView.instance().showPanel(${JSON.stringify(react.id)});return true;})()`,
                awaitPromise: true,
                returnByValue: true
            });
        nativeInspectors.push({ targetId: target.id, send });
        fs.writeFileSync(
            `${output}/tabs-${target.id}.json`,
            JSON.stringify({ tabs, inventory, selected: react?.id }, null, 4)
        );
        await page.waitForTimeout(6000);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        if (shot.result?.data)
            fs.writeFileSync(
                `${output}/native-${target.id}.png`,
                Buffer.from(shot.result.data, 'base64')
            );
    }
    const targets = await cdp.send('Target.getTargets');
    const results = [];
    let readPanel;
    for (const target of targets.targetInfos.filter(
        (t) =>
            t.url.endsWith('/devtools.html') ||
            t.url.endsWith('/devtools-panel.html')
    )) {
        const { sessionId } = await cdp.send('Target.attachToTarget', {
            targetId: target.targetId,
            flatten: false
        });
        const evaluate = (expression) =>
            new Promise(async (resolve) => {
                const listener = (event) => {
                    if (event.sessionId === sessionId) {
                        const reply = JSON.parse(event.message);
                        if (reply.id === 1) {
                            cdp.off(
                                'Target.receivedMessageFromTarget',
                                listener
                            );
                            resolve(reply);
                        }
                    }
                };
                cdp.on('Target.receivedMessageFromTarget', listener);
                await cdp.send('Target.sendMessageToTarget', {
                    sessionId,
                    message: JSON.stringify({
                        id: 1,
                        method: 'Runtime.evaluate',
                        params: {
                            expression,
                            awaitPromise: true,
                            returnByValue: true
                        }
                    })
                });
            });
        const inspectedExpression = `({url:location.href,detected:Boolean(window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size),backendScript:document.getElementById('__react-devtools-user-app__')?.src,frames:document.querySelectorAll('iframe').length,hookKeys:Object.keys(window.__REACT_DEVTOOLS_GLOBAL_HOOK__??{})})`;
        const result = await evaluate(
            `new Promise(resolve => { const identity={url:location.href,body:document.body.innerText,tabId:chrome.devtools.inspectedWindow.tabId}; chrome.devtools.inspectedWindow.eval(${JSON.stringify(inspectedExpression)},(result,exception)=>resolve({...identity,inspected:result,exception})); })`
        );
        if (
            updateMode &&
            target.url.endsWith('/devtools-panel.html') &&
            result.result?.result?.value?.inspected?.url === url
        ) {
            readPanel = async () => {
                const reply = await evaluate(
                    `({url:location.href,body:document.body.innerText,tabId:chrome.devtools.inspectedWindow.tabId,roots:Array.from(document.querySelectorAll('[data-dt-root-id]'),node=>({id:node.dataset.dtRootId,rendererId:node.dataset.dtRendererId,commitCount:Number(node.dataset.dtCommitCount)}))})`
                );
                return reply.result?.result?.value;
            };
        }
        results.push({ target, result });
        console.log('Native panel/host', JSON.stringify(result));
    }
    let updateChecks;
    if (updateMode) {
        assert(readPanel, 'Actual inspected native panel not found');
        const snapshots = [];
        const waitForPanel = async (stage, predicate) => {
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline) {
                const panel = await readPanel();
                if (panel?.body.includes('\nConnected\n') && predicate(panel)) {
                    snapshots.push({ stage, panel });
                    return panel;
                }
                await page.waitForTimeout(50);
            }
            throw new Error(`Native panel failed to update: ${stage}`);
        };
        const initial = await waitForPanel(
            'initial',
            (panel) => panel.roots.length === 1
        );
        const commits = initial.roots[0].commitCount;
        await page.locator('#increment').click();
        await waitForPanel(
            'increment',
            (panel) => panel.roots[0]?.commitCount === commits + 1
        );
        const trafficBeforeBurst = await page.evaluate(
            () => window.__r04Traffic.updates.length
        );
        await page.locator('#burst').click();
        await waitForPanel(
            'burst',
            (panel) => panel.roots[0]?.commitCount === commits + 26
        );
        const trafficAfterBurst = await page.evaluate(
            () => window.__r04Traffic.updates.length
        );
        assert(
            trafficAfterBurst - trafficBeforeBurst < 25,
            'Commit burst was not coalesced'
        );
        await page.locator('#toggle-child').click();
        await waitForPanel(
            'child-unmount',
            (panel) =>
                panel.roots.length === 1 &&
                panel.roots[0].commitCount > commits + 26
        );
        await page.locator('#mount-secondary').click();
        const mounted = await waitForPanel(
            'secondary-mounted',
            (panel) =>
                panel.roots.length === 2 &&
                panel.roots.every((root) => root.rendererId === '1')
        );
        await page.locator('#unmount-secondary').click();
        await waitForPanel(
            'secondary-unmounted',
            (panel) => panel.roots.length === 1
        );
        await page.locator('#mount-secondary').click();
        await waitForPanel(
            'secondary-remounted',
            (panel) =>
                panel.roots.length === 2 &&
                panel.roots[1].id !== mounted.roots[1].id
        );
        for (const inspector of nativeInspectors) {
            const shot = await inspector.send('Page.captureScreenshot', {
                format: 'png'
            });
            if (shot.result?.data)
                fs.writeFileSync(
                    `${output}/updated-${inspector.targetId}.png`,
                    Buffer.from(shot.result.data, 'base64')
                );
        }
        for (const inspector of nativeInspectors)
            await cdp.send('Target.closeTarget', {
                targetId: inspector.targetId
            });
        await page.waitForTimeout(300);
        assert(!page.isClosed(), 'Closing DevTools also closed the fixture');
        const beforeClosedCommit = await page.evaluate(
            () => window.__r04Traffic.updates.length
        );
        await page.locator('#burst').click();
        await page.waitForTimeout(300);
        const traffic = await page.evaluate(() => window.__r04Traffic);
        assert(traffic.disconnects > 0, 'Native disconnect signal missing');
        assert.equal(
            traffic.updates.length,
            beforeClosedCommit,
            'Disconnected backend still published'
        );
        updateChecks = {
            snapshots,
            trafficBeforeBurst,
            trafficAfterBurst,
            beforeClosedCommit,
            traffic,
            inspectedCounter: await page.locator('#counter').innerText(),
            closedNativeInspectors: nativeInspectors.map(
                (inspector) => inspector.targetId
            )
        };
        console.log('Native update checks', JSON.stringify(updateChecks));
    }
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify(
            {
                browser,
                extension,
                url,
                targets,
                results,
                errors,
                updateChecks
            },
            null,
            4
        )
    );
} finally {
    sockets.forEach((ws) => ws.close());
    await context.close();
}
