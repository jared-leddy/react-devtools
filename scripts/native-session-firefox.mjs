import fs from 'node:fs';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';

const url = process.argv[2];
if (!url) throw new Error('Provide a fixture URL');
const output = process.argv[3] ?? '/private/tmp/r03-firefox';
const updateMode = process.argv.includes('--updates');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync('/private/tmp/r03-firefox-profile-');
fs.writeFileSync(
    `${profile}/user.js`,
    'user_pref("marionette.port",2829);\nuser_pref("devtools.chrome.enabled",true);\nuser_pref("devtools.debugger.remote-enabled",true);\nuser_pref("devtools.toolbox.footer.height",800);\n'
);
const child = spawn(
    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    ['--no-remote', '--profile', profile, '--marionette', 'about:blank'],
    { env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' } }
);
child.stderr.on('data', () => {});
let socket;
try {
    for (let i = 0; i < 60; i++) {
        try {
            socket = await new Promise((resolve, reject) => {
                const s = net.connect(2829, '127.0.0.1');
                s.once('connect', () => resolve(s));
                s.once('error', reject);
            });
            break;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    if (!socket) throw new Error('Marionette did not start');
    let buffer = Buffer.alloc(0),
        id = 0;
    const pending = new Map();
    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (true) {
            const colon = buffer.indexOf(':');
            if (colon < 0) return;
            const length = Number(buffer.subarray(0, colon).toString());
            if (buffer.length < colon + 1 + length) return;
            const message = JSON.parse(
                buffer.subarray(colon + 1, colon + 1 + length)
            );
            buffer = buffer.subarray(colon + 1 + length);
            if (Array.isArray(message)) {
                const callback = pending.get(message[1]);
                pending.delete(message[1]);
                if (message[2])
                    callback?.reject(new Error(JSON.stringify(message[2])));
                else callback?.resolve(message[3]);
            }
        }
    });
    const command = (name, params = {}) =>
        new Promise((resolve, reject) => {
            const next = ++id;
            pending.set(next, { resolve, reject });
            const payload = JSON.stringify([0, next, name, params]);
            socket.write(`${Buffer.byteLength(payload)}:${payload}`);
            setTimeout(() => {
                if (pending.delete(next)) reject(new Error(`Timeout ${name}`));
            }, 30000).unref();
        });
    const session = await command('WebDriver:NewSession', {});
    await command('Addon:Install', {
        path: new URL(
            '../packages/devtools-firefox-extension/dist',
            import.meta.url
        ).pathname,
        temporary: true
    });
    await command('WebDriver:SetWindowRect', { width: 1500, height: 1500 });
    await command('WebDriver:Navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const execute = (script) =>
        command('WebDriver:ExecuteScript', {
            script,
            args: [],
            newSandbox: true
        });
    const app = await execute(
        'const hook=window.__REACT_DEVTOOLS_GLOBAL_HOOK__;return {url:location.href,hook:!!hook,renderers:hook?[...hook.renderers].map(([id,r])=>({id,version:r.version,roots:hook.getFiberRoots(id).size})):[]};'
    );
    if (updateMode)
        await execute(
            `window.__r04Traffic={updates:[],disconnects:0};window.addEventListener('message',event=>{if(event.data?.event==='__react-devtools-extension-disconnect__')window.__r04Traffic.disconnects++;const rpc=event.data?.payload?.json;if(event.data?.source==='react-devtools:server-to-proxy'&&rpc?.m==='notifySessionUpdated'){const update=rpc.a?.[0];window.__r04Traffic.updates.push({sessionId:update?.sessionId,streamId:update?.streamId,baseRevision:update?.baseRevision,revision:update?.revision,fields:Object.keys(update?.patch??{}),roots:update?.patch?.roots});}});return true;`
        );
    await command('Marionette:SetContext', { value: 'chrome' });
    const showToolbox = () =>
        command('WebDriver:ExecuteAsyncScript', {
            script: 'const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule("resource://devtools/shared/loader/Loader.sys.mjs");const {gDevTools}=require("devtools/client/framework/devtools");(async()=>{const t=await gDevTools.showToolboxForTab(gBrowser.selectedTab);await new Promise(r=>setTimeout(r,4000));const tools=t.getVisibleAdditionalTools().map(p=>({id:p.id,label:p.label}));const react=tools.find(p=>p.label==="React");if(!react)throw Error("Native React panel missing");await t.selectTool(react.id);await new Promise(r=>setTimeout(r,7000));const frame=t.doc.querySelector("iframe[aria-label=React]");const browser=frame?.contentDocument?.querySelector("browser");done({url:gBrowser.selectedBrowser.currentURI.spec,browsingContextId:gBrowser.selectedBrowser.browsingContext.id,tools,panelUrl:browser?.getAttribute("src"),panelBody:browser?.contentDocument?.body?.innerText,panelBrowsingContextId:browser?.browsingContext?.id});})().catch(e=>done({error:String(e)}));',
            args: [],
            newSandbox: true
        });
    const toolbox = await showToolbox();
    console.log('Native Firefox', JSON.stringify({ app, toolbox }));
    const screenshot = await command('WebDriver:TakeScreenshot', {
        full: true
    });
    fs.writeFileSync(
        `${output}/native.png`,
        Buffer.from(screenshot.value, 'base64')
    );
    let updateChecks;
    if (updateMode) {
        assert(
            toolbox.value.panelBrowsingContextId,
            'Actual native extension context not found'
        );
        const stages = [];
        for (const [index, id] of [
            'increment',
            'burst',
            'toggle-child',
            'mount-secondary',
            'unmount-secondary',
            'mount-secondary'
        ].entries()) {
            await command('Marionette:SetContext', { value: 'content' });
            await execute(
                `const button=document.getElementById(${JSON.stringify(id)});if(!button||button.disabled)throw Error('Fixture action unavailable');button.click();return true;`
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
            const observed = await execute(
                `return {url:location.href,counter:document.getElementById('counter').textContent,traffic:window.__r04Traffic};`
            );
            stages.push({ index, id, observed });
            const roots = [...observed.value.traffic.updates]
                .reverse()
                .find((event) => event.roots)?.roots;
            assert(roots, `No actual backend root update for ${id}`);
            assert(
                roots.every((root) => root.rendererId === 1),
                'Root renderer association lost'
            );
            if (index === 0) assert.equal(roots[0].commitCount, 1);
            if (index === 1) {
                assert.equal(roots[0].commitCount, 26);
                assert(
                    observed.value.traffic.updates.length -
                        stages[0].observed.value.traffic.updates.length <
                        25,
                    'Burst not coalesced'
                );
            }
            assert.equal(roots.length, index === 3 || index === 5 ? 2 : 1);
            if (index === 5) {
                const previous = [...stages[3].observed.value.traffic.updates]
                    .reverse()
                    .find((event) => event.roots).roots;
                assert.notEqual(
                    roots[1].id,
                    previous[1].id,
                    'Removed root identity reused'
                );
            }
            await command('Marionette:SetContext', { value: 'chrome' });
            const shot = await command('WebDriver:TakeScreenshot', {
                full: true
            });
            fs.writeFileSync(
                `${output}/updated-${index}-${id}.png`,
                Buffer.from(shot.value, 'base64')
            );
        }
        const closed = await command('WebDriver:ExecuteAsyncScript', {
            script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');(async()=>{const t=await gDevTools.showToolboxForTab(gBrowser.selectedTab);await t.destroy();done({url:gBrowser.selectedBrowser.currentURI.spec});})().catch(error=>done({error:String(error)}));`,
            args: [],
            newSandbox: true
        });
        assert.equal(closed.value.url, url);
        await command('Marionette:SetContext', { value: 'content' });
        await new Promise((resolve) => setTimeout(resolve, 300));
        const beforeClosedCommit = await execute(
            'return window.__r04Traffic.updates.length;'
        );
        await execute("document.getElementById('burst').click();return true;");
        await new Promise((resolve) => setTimeout(resolve, 500));
        const paused = await execute(
            "return {counter:document.getElementById('counter').textContent,traffic:window.__r04Traffic};"
        );
        assert(
            paused.value.traffic.disconnects > 0,
            'Native disconnect signal missing'
        );
        assert.equal(
            paused.value.traffic.updates.length,
            beforeClosedCommit.value,
            'Disconnected producer still published'
        );
        await command('Marionette:SetContext', { value: 'chrome' });
        const reopened = await showToolbox();
        assert(
            reopened.value.panelBrowsingContextId,
            'Reopened native panel missing'
        );
        assert.notEqual(
            reopened.value.panelBrowsingContextId,
            toolbox.value.panelBrowsingContextId
        );
        await command('Marionette:SetContext', { value: 'content' });
        await execute(
            "document.getElementById('increment').click();return true;"
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        const resumed = await execute(
            "return {counter:document.getElementById('counter').textContent,traffic:window.__r04Traffic};"
        );
        assert.notEqual(
            resumed.value.traffic.updates.at(-1).streamId,
            stages[0].observed.value.traffic.updates[0].streamId
        );
        await command('Marionette:SetContext', { value: 'chrome' });
        const shot = await command('WebDriver:TakeScreenshot', { full: true });
        fs.writeFileSync(
            `${output}/reopened.png`,
            Buffer.from(shot.value, 'base64')
        );
        updateChecks = {
            stages,
            closed,
            beforeClosedCommit,
            paused,
            reopened,
            resumed
        };
        console.log(
            'Native Firefox update checks passed',
            JSON.stringify({
                stages: stages.length,
                beforeClosedCommit: beforeClosedCommit.value,
                pausedCounter: paused.value.counter,
                resumedCounter: resumed.value.counter
            })
        );
    }
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify({ session, app, toolbox, updateChecks }, null, 4)
    );
} finally {
    socket?.destroy();
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
}
