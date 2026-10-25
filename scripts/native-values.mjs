import assert from 'node:assert/strict';
export async function verifyNativeValues(page, evaluate, capture) {
    const panel = async (action) => {
        const reply = await evaluate(
            `(async()=>{${action ?? ''};await new Promise(r=>setTimeout(r,200));return {body:document.body.innerText,sections:[...document.querySelectorAll('.dt-state-viewer__section')].map(node=>({name:node.getAttribute('aria-label'),text:node.innerText}))};})()`
        );
        return reply.result?.result?.value;
    };
    const snapshots = [];
    const wait = async (stage, predicate) => {
        let last;
        for (let i = 0; i < 60; i++) {
            last = await panel();
            if (last && predicate(last)) {
                snapshots.push({ stage, ...last });
                return last;
            }
        }
        throw Error(`${stage}: ${JSON.stringify(last)}`);
    };
    const select = async (name) => {
        await panel(
            `const input=[...document.querySelectorAll('label')].find(node=>node.textContent.includes('Tree filter')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(name)});input.dispatchEvent(new Event('input',{bubbles:true}));`
        );
        await panel(
            `const label=[...document.querySelectorAll('.dt-components-tree__label')].find(node=>node.textContent===${JSON.stringify(name)});label.closest('button').click();`
        );
    };
    await panel(
        `[...document.querySelectorAll('a')].find(node=>node.textContent==='Components').click();`
    );
    await select('InspectorFunction');
    await wait(
        'function-before',
        (state) =>
            state.body.includes('"R07 props 0"') &&
            state.sections.some(
                (section) =>
                    section.name === 'Context' &&
                    section.text.includes('"light"')
            )
    );
    await page.locator('#function-update').click();
    await page.locator('#update-app').click();
    const after = await wait(
        'function-after',
        (state) =>
            state.body.includes('"R07 props 1"') &&
            state.sections.some(
                (section) =>
                    section.name === 'Context' &&
                    section.text.includes('"dark"')
            ) &&
            state.sections.some(
                (section) =>
                    section.name === 'Hooks' &&
                    /\b6\b/.test(section.text) &&
                    /\b3\b/.test(section.text)
            )
    );
    assert(
        after.body.includes('Truncated') && after.body.includes('Unavailable')
    );
    await capture('function');
    await select('InspectorClass');
    await wait(
        'class-before',
        (state) =>
            state.body.includes('"class-prop"') &&
            state.sections.some(
                (section) =>
                    section.name === 'Class State' &&
                    section.text.includes('10')
            )
    );
    await page.locator('#class-update').click();
    await wait(
        'class-after',
        (state) =>
            state.sections.some(
                (section) =>
                    section.name === 'Class State' &&
                    section.text.includes('11')
            ) && !state.sections.some((section) => section.name === 'Hooks')
    );
    await capture('class');
    return { snapshots };
}
