import fs from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';

const url = process.argv[2];
if (!url) throw new Error('Provide a fixture URL');
const output = process.argv[3] ?? '/private/tmp/r03-firefox';
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync('/private/tmp/r03-firefox-profile-');
fs.writeFileSync(
    `${profile}/user.js`,
    'user_pref("marionette.port",2829);\nuser_pref("devtools.chrome.enabled",true);\nuser_pref("devtools.debugger.remote-enabled",true);\nuser_pref("devtools.toolbox.footer.height",800);\n'
);
const child = spawn(
    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    [
        '--no-remote',
        '--profile',
        profile,
        '--marionette',
        '--remote-allow-system-access',
        'about:blank'
    ]
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
    await command('Marionette:SetContext', { value: 'chrome' });
    const toolbox = await command('WebDriver:ExecuteAsyncScript', {
        script: 'const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule("resource://devtools/shared/loader/Loader.sys.mjs");const {gDevTools}=require("devtools/client/framework/devtools");(async()=>{const t=await gDevTools.showToolboxForTab(gBrowser.selectedTab);await new Promise(r=>setTimeout(r,4000));const tools=t.getVisibleAdditionalTools().map(p=>({id:p.id,label:p.label}));const react=tools.find(p=>p.label==="React");if(!react)throw Error("Native React panel missing");await t.selectTool(react.id);await new Promise(r=>setTimeout(r,7000));const frame=t.doc.querySelector("iframe[aria-label=React]");const browser=frame?.contentDocument?.querySelector("browser");done({url:gBrowser.selectedBrowser.currentURI.spec,browsingContextId:gBrowser.selectedBrowser.browsingContext.id,tools,panelUrl:browser?.getAttribute("src"),panelBody:browser?.contentDocument?.body?.innerText,panelBrowsingContextId:browser?.browsingContext?.id});})().catch(e=>done({error:String(e)}));',
        args: [],
        newSandbox: true
    });
    console.log('Native Firefox', JSON.stringify({ app, toolbox }));
    const screenshot = await command('WebDriver:TakeScreenshot', {
        full: true
    });
    fs.writeFileSync(
        `${output}/native.png`,
        Buffer.from(screenshot.value, 'base64')
    );
    fs.writeFileSync(
        `${output}/result.json`,
        JSON.stringify({ session, app, toolbox }, null, 4)
    );
} finally {
    socket?.destroy();
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
}
