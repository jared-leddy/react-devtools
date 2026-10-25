import fs from 'node:fs';
import assert from 'node:assert/strict';
export async function verifyFirefoxValues(command, execute, output) {
    const context = async (value) =>
        command('Marionette:SetContext', { value });
    const pause = () => new Promise((resolve) => setTimeout(resolve, 500));
    await context('content');
    await execute(
        `window.__r07Inspections=[];const pending=new Set();window.addEventListener('message',event=>{const rpc=event.data?.payload?.json;if(rpc?.m==='getComponentState')pending.add(rpc.i);if(rpc?.t==='s'&&pending.has(rpc.i)){window.__r07Inspections.push(rpc.r);pending.delete(rpc.i);}});return true;`
    );
    await context('chrome');
    await command('WebDriver:ExecuteAsyncScript', {
        script: `const done=arguments[arguments.length-1];const {require}=ChromeUtils.importESModule('resource://devtools/shared/loader/Loader.sys.mjs');const {gDevTools}=require('devtools/client/framework/devtools');gDevTools.showToolboxForTab(gBrowser.selectedTab).then(t=>{t.doc.querySelector('iframe[aria-label=React]').contentDocument.querySelector('browser').focus();done(true);});`,
        args: [],
        newSandbox: true
    });
    const keys = async (values) =>
        command('WebDriver:PerformActions', {
            actions: [
                {
                    type: 'key',
                    id: 'values-keys',
                    actions: values.flatMap((value) => [
                        { type: 'keyDown', value },
                        { type: 'keyUp', value }
                    ])
                }
            ]
        });
    await keys(['\uE004', '\uE004', '\uE004', '\uE004', '\uE007']);
    await pause();
    await keys([
        '\uE004',
        '\uE004',
        '\uE004',
        ...'Inspector',
        '\uE004',
        '\uE004',
        '\uE011'
    ]);
    await pause();
    const snapshots = [];
    const read = async () => {
        await context('content');
        return (await execute('return window.__r07Inspections.at(-1);')).value;
    };
    const find = async (predicate) => {
        let last;
        for (let i = 0; i < 40; i++) {
            last = await read();
            if (last && predicate(last)) return last;
            await context('chrome');
            await keys(['\uE015']);
            await pause();
        }
        throw Error(`Native selection failed: ${JSON.stringify(last)}`);
    };
    const field = (inspection, section, name) =>
        inspection.sections
            .find((item) => item.name === section)
            ?.fields.find((item) => item.name === name)?.value;
    const before = await find(
        (value) => field(value, 'props', 'marker') === 'R07 props 0'
    );
    snapshots.push({ stage: 'function-before', inspection: before });
    assert.equal(
        before.sections.find((section) => section.name === 'hooks').fields[0]
            .value,
        5
    );
    await execute(
        `document.getElementById('function-update').click();document.getElementById('update-app').click();return true;`
    );
    await pause();
    const after = await read();
    assert.equal(after.componentId, before.componentId);
    assert.equal(field(after, 'props', 'marker'), 'R07 props 1');
    const hooks = after.sections.find(
        (section) => section.name === 'hooks'
    ).fields;
    assert.equal(hooks[0].value, 6);
    assert.deepEqual(hooks[1].value._custom.value, { count: 3 });
    assert(
        after.sections.some(
            (section) =>
                section.name === 'context' &&
                JSON.stringify(section.fields).includes('dark')
        )
    );
    assert.equal(after.editing.state, false);
    snapshots.push({ stage: 'function-after', inspection: after });
    const capture = async (stage) => {
        await context('chrome');
        const shot = await command('WebDriver:TakeScreenshot', { full: true });
        fs.writeFileSync(
            `${output}/${stage}.png`,
            Buffer.from(shot.value, 'base64')
        );
    };
    await capture('function');
    const classBefore = await find(
        (value) => field(value, 'props', 'marker') === 'class-prop'
    );
    assert.equal(
        field(classBefore, 'state', 'Class state')._custom.value.clicks,
        10
    );
    snapshots.push({ stage: 'class-before', inspection: classBefore });
    await execute(
        `document.getElementById('class-update').click();return true;`
    );
    await pause();
    const classAfter = await read();
    assert.equal(classAfter.componentId, classBefore.componentId);
    assert.equal(
        field(classAfter, 'state', 'Class state')._custom.value.clicks,
        11
    );
    assert(!classAfter.sections.some((section) => section.name === 'hooks'));
    snapshots.push({ stage: 'class-after', inspection: classAfter });
    await capture('class');
    return { snapshots };
}
