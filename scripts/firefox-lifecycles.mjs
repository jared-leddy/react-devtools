import fs from 'node:fs';
import assert from 'node:assert/strict';
export async function verifyFirefoxLifecycles({
    command,
    execute,
    showToolbox,
    toolbox,
    output
}) {
    const ctx = (value) => command('Marionette:SetContext', { value });
    const pause = () => new Promise((r) => setTimeout(r, 150));
    const snapshots = [];
    const observe = async () => {
        await ctx('content');
        await execute(
            `window.__r08={inspections:[],updates:[],disconnects:0};const pending=new Set();window.addEventListener('message',event=>{const rpc=event.data?.payload?.json;if(event.data?.event==='__react-devtools-extension-disconnect__')window.__r08.disconnects++;if(rpc?.m==='getComponentState')pending.add(rpc.i);if(rpc?.m==='notifySessionUpdated')window.__r08.updates.push(rpc.a[0]);if(rpc?.t==='s'&&pending.has(rpc.i)){window.__r08.inspections.push(rpc.r);pending.delete(rpc.i);}});return true;`
        );
    };
    const keys = (values) =>
        command('WebDriver:PerformActions', {
            actions: [
                {
                    type: 'key',
                    id: 'lifecycle-keys',
                    actions: values.flatMap((value) => [
                        { type: 'keyDown', value },
                        { type: 'keyUp', value }
                    ])
                }
            ]
        });
    const select = async () => {
        await ctx('chrome');
        await command('WebDriver:ExecuteAsyncScript', {
            script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');gDevTools.showToolboxForTab(gBrowser.selectedTab).then(t=>{t.doc.querySelector('iframe[aria-label=React]').contentDocument.querySelector('browser').focus();done(true);});`,
            args: [],
            newSandbox: true
        });
        await keys(['\uE004', '\uE004', '\uE004', '\uE004', '\uE007']);
        await pause();
        await keys([
            '\uE004',
            '\uE004',
            '\uE004',
            ...'LifecycleApp',
            '\uE004',
            '\uE004',
            '\uE011'
        ]);
    };
    const read = async () => {
        await ctx('content');
        return (await execute('return window.__r08;')).value;
    };
    const wait = async (stage, predicate) => {
        let last;
        for (let i = 0; i < 60; i++) {
            last = await read();
            if (predicate(last)) {
                snapshots.push({ stage, ...last });
                return last;
            }
            await pause();
        }
        throw Error(`${stage}: ${JSON.stringify(last)}`);
    };
    const value = (state) => state.inspections.at(-1);
    const has = (state, item) =>
        JSON.stringify(value(state)?.sections).includes(item);
    await observe();
    await select();
    const initial = await wait('late-open-values', (state) =>
        has(state, '"A"')
    );
    await execute(`document.getElementById('increment').click();return true;`);
    await wait(
        'increment',
        (state) =>
            value(state)?.sections.find((section) => section.name === 'hooks')
                ?.fields[0].value === 1
    );
    const version = `v${Date.now()}`;
    await execute(`fetch('/__r08/update?version=${version}');return true;`);
    const hot = await wait('actual-fast-refresh', (state) =>
        has(state, version)
    );
    assert.equal(value(hot).componentId, value(initial).componentId);
    assert.equal(
        value(hot).sections.find((section) => section.name === 'hooks')
            .fields[0].value,
        1
    );
    await command('WebDriver:Refresh');
    await observe();
    // Selection from the old document is deliberately invalid; backend commits must
    // nevertheless reach the still-open native panel's newly negotiated stream.
    // Commit real app updates until negotiation finishes, rather than requiring a
    // single commit to occur after an arbitrary startup delay.
    for (let attempt = 0; attempt < 60; attempt++) {
        if ((await read()).updates.length) break;
        await execute(
            `document.getElementById('increment').click();return true;`
        );
        await pause();
    }
    await wait('reload-auto-reconnect', (state) => state.updates.length > 0);
    const reloadCount = Number(
        (
            await execute(
                `return document.getElementById('counter').textContent;`
            )
        ).value
    );
    await ctx('chrome');
    const retained = await showToolbox();
    assert.equal(
        retained.value.panelBrowsingContextId,
        toolbox.value.panelBrowsingContextId
    );
    await command('WebDriver:ExecuteAsyncScript', {
        script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');gDevTools.showToolboxForTab(gBrowser.selectedTab).then(t=>t.destroy()).then(()=>done(true));`,
        args: [],
        newSandbox: true
    });
    await ctx('content');
    await pause();
    const closed = await read();
    assert(closed.disconnects > 0);
    await execute(`document.getElementById('increment').click();return true;`);
    await pause();
    const stopped = await read();
    assert.equal(stopped.updates.length, closed.updates.length);
    await ctx('chrome');
    const reopened = await showToolbox();
    assert.notEqual(
        reopened.value.panelBrowsingContextId,
        toolbox.value.panelBrowsingContextId
    );
    await select();
    const restored = await wait(
        'actual-devtools-reopen',
        (state) =>
            has(state, '"A"') &&
            value(state)?.sections.find((section) => section.name === 'hooks')
                ?.fields[0].value ===
                reloadCount + 1
    );
    assert.notEqual(value(restored).componentId, value(initial).componentId);
    await ctx('chrome');
    const shot = await command('WebDriver:TakeScreenshot', { full: true });
    fs.writeFileSync(
        `${output}/recovered.png`,
        Buffer.from(shot.value, 'base64')
    );
    return {
        snapshots,
        reloadCount,
        originalContext: toolbox.value.panelBrowsingContextId,
        retainedContext: retained.value.panelBrowsingContextId,
        reopenedContext: reopened.value.panelBrowsingContextId,
        stoppedUpdates: closed.updates.length
    };
}
