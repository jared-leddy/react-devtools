import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function verifyFirefoxPicker({ command, execute, output }) {
    const ctx = (value) => command('Marionette:SetContext', { value });
    const pause = () => new Promise((r) => setTimeout(r, 150));
    const keys = (values) =>
        command('WebDriver:PerformActions', {
            actions: [
                {
                    type: 'key',
                    id: 'picker-keys',
                    actions: values.flatMap((value) => [
                        { type: 'keyDown', value },
                        { type: 'keyUp', value }
                    ])
                }
            ]
        });
    const focus = async () => {
        await ctx('chrome');
        await command('WebDriver:ExecuteAsyncScript', {
            script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');gDevTools.showToolboxForTab(gBrowser.selectedTab).then(t=>{t.doc.querySelector('iframe[aria-label=React]').contentDocument.querySelector('browser').focus();done(true);});`,
            args: [],
            newSandbox: true
        });
    };
    await ctx('content');
    await execute(
        `window.__r09={requests:[],inspections:[],updates:[]};const pending=new Set();window.addEventListener('message',event=>{const rpc=event.data?.payload?.json;if(!rpc)return;if(rpc.m)window.__r09.requests.push(rpc.m);if(rpc.m==='getComponentState')pending.add(rpc.i);if(rpc.m==='notifySessionUpdated')window.__r09.updates.push(rpc.a[0]);if(rpc.t==='s'&&pending.has(rpc.i)){window.__r09.inspections.push(rpc.r);pending.delete(rpc.i);}});return true;`
    );
    const read = async () => {
        await ctx('content');
        return (
            await execute(
                `return {hint:!!document.querySelector('[data-react-devtools-picker]'),highlight:!!document.querySelector('[data-react-devtools-highlighter]'),traffic:window.__r09,text:document.querySelector('#pick-target').textContent};`
            )
        ).value;
    };
    const wait = async (predicate) => {
        let last;
        for (let i = 0; i < 60; i++) {
            last = await read();
            if (predicate(last)) return last;
            await pause();
        }
        throw Error(JSON.stringify(last));
    };
    await focus();
    await keys(['\uE004', '\uE004', '\uE004', '\uE004', '\uE007']);
    await pause();
    await keys(['\uE004', '\uE004', '\uE004', '\uE007']);
    await wait((s) => s.hint);
    const point = async (selector) => {
        await ctx('content');
        return (
            await execute(
                `const node=document.querySelector(${JSON.stringify(selector)});node.scrollIntoView({block:'center'});const r=node.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};`
            )
        ).value;
    };
    const move = async (selector, click = false) => {
        const p = await point(selector);
        await command('WebDriver:PerformActions', {
            actions: [
                {
                    type: 'pointer',
                    id: 'picker-pointer',
                    parameters: { pointerType: 'mouse' },
                    actions: [
                        { type: 'pointerMove', duration: 50, x: p.x, y: p.y },
                        ...(click
                            ? [
                                  { type: 'pointerDown', button: 0 },
                                  { type: 'pointerUp', button: 0 }
                              ]
                            : [])
                    ]
                }
            ]
        });
    };
    await move('#pick-target span');
    await wait((s) => s.highlight);
    await move('#pick-target span', true);
    const picked = await wait((s) => {
        const target = s.traffic.updates
            .map((u) => u.patch?.inspectMode?.lastSelectedTarget)
            .filter(Boolean)
            .at(-1);
        return (
            !s.hint &&
            target &&
            s.traffic.inspections.some(
                (v) =>
                    v.componentId === target.componentId &&
                    v.sections.some(
                        (section) =>
                            section.name === 'hooks' &&
                            section.fields.some((f) => f.value === 0)
                    )
            )
        );
    });
    assert.equal(picked.text, 'Nested target 0');
    const snapshots = [{ stage: 'picked', ...picked }];
    for (let i = 0; i < 3; i++) {
        await focus();
        await keys(['\uE007']);
        await wait((s) => s.hint);
        await ctx('content');
        await keys(['\uE00C']);
        snapshots.push({
            stage: `cancel-${i}`,
            ...(await wait(
                (s) =>
                    !s.hint &&
                    !s.highlight &&
                    s.traffic.updates.filter((u) => u.patch?.inspectMode).at(-1)
                        ?.patch.inspectMode.enabled === false
            ))
        });
    }
    await ctx('chrome');
    const shot = await command('WebDriver:TakeScreenshot', { full: true });
    fs.writeFileSync(`${output}/picker.png`, Buffer.from(shot.value, 'base64'));
    await focus();
    await keys(['\uE007']);
    await wait((s) => s.hint);
    await ctx('chrome');
    await command('WebDriver:ExecuteAsyncScript', {
        script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');gDevTools.getToolboxForTab(gBrowser.selectedTab).destroy().then(()=>done(true));`,
        args: [],
        newSandbox: true
    });
    await wait(
        (s) =>
            !s.hint &&
            !s.highlight &&
            s.traffic.updates.filter((u) => u.patch?.inspectMode).at(-1)?.patch
                .inspectMode.enabled === false
    );
    await move('#pick-target span', true);
    assert.equal((await read()).text, 'Nested target 1');
    return {
        snapshots,
        actualKeyboardAndPointer: true,
        disconnectCleanup: true
    };
}
