import assert from 'node:assert/strict';

// evaluate executes in the actual registered extension panel, never a substitute page.
export async function verifyNativeIdentity(
    page,
    evaluate,
    capture = async () => {}
) {
    const panel = async (action = '') => {
        const reply = await evaluate(
            `(async()=>{${action};await new Promise(resolve=>setTimeout(resolve,300));return {body:document.body.innerText,rows:[...document.querySelectorAll('[data-component-key]')].map(node=>({id:node.dataset.nodeId,rootId:node.dataset.rootId,key:node.dataset.componentKey,selected:node.getAttribute('aria-selected'),label:node.innerText})),values:[...document.querySelectorAll('.dt-state-viewer__value')].map(node=>node.textContent)};})()`
        );
        return reply.result?.result?.value;
    };
    const snapshots = [];
    const wait = async (stage, predicate) => {
        let last;
        for (let i = 0; i < 60; i++) {
            const state = await panel();
            last = state;
            if (state && predicate(state)) {
                snapshots.push({ stage, ...state });
                return state;
            }
        }
        throw new Error(
            `Native identity failed: ${stage}: ${JSON.stringify(last)}`
        );
    };
    await panel(
        `[...document.querySelectorAll('a')].find(node=>node.textContent==='Components').click()`
    );
    await panel(
        `const input=[...document.querySelectorAll('label')].find(node=>node.textContent.includes('Tree filter')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Row');input.dispatchEvent(new Event('input',{bubbles:true}))`
    );
    const initial = await wait('rows', (state) =>
        state.rows.some((row) => row.key === 'b')
    );
    const original = initial.rows.find((row) => row.key === 'b');
    assert.match(original.id, /^c:[0-9a-f-]{36}:[0-9a-z]+$/);
    await panel(
        `document.querySelector('[data-component-key="b"] .dt-components-tree__node').click()`
    );
    await wait('selected', (state) => state.values.includes('"b"'));
    await page.locator('#increment-b').click();
    await wait('state-update', (state) => state.values.includes('1'));
    await page.locator('#reorder').click();
    await wait(
        'reorder',
        (state) =>
            state.rows.some(
                (row) =>
                    row.key === 'b' &&
                    row.id === original.id &&
                    row.selected === 'true'
            ) && state.values.includes('1')
    );
    await page.locator('#rename').click();
    await wait('rename', (state) =>
        state.rows.some(
            (row) => row.id === original.id && row.label.includes('RenamedRow')
        )
    );
    await page.locator('#remove-b').click();
    await wait(
        'unmounted',
        (state) =>
            !state.rows.some((row) => row.id === original.id) &&
            state.body.includes('No component selected')
    );
    await page.locator('#restore-b').click();
    const remounted = await wait(
        'remounted',
        (state) =>
            state.rows.some(
                (row) => row.key === 'b' && row.id !== original.id
            ) && state.body.includes('No component selected')
    );
    await panel(
        `document.querySelector('[data-component-key="b"] .dt-components-tree__node').click()`
    );
    await wait(
        'reset-state',
        (state) => state.values.includes('"b"') && state.values.includes('0')
    );
    await capture();
    await page.locator('#remove-primary').click();
    await wait(
        'root-removed',
        (state) =>
            state.rows.length === 0 &&
            state.body.includes('No component selected')
    );
    return {
        original,
        remounted: remounted.rows.find((row) => row.key === 'b'),
        snapshots
    };
}
