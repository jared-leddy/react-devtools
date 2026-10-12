import fs from 'node:fs';
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
            new Promise((resolve) => {
                const id = ++next;
                pending.set(id, resolve);
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
        results.push({ target, result });
        console.log('Native panel/host', JSON.stringify(result));
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
                errors
            },
            null,
            4
        )
    );
} finally {
    sockets.forEach((ws) => ws.close());
    await context.close();
}
