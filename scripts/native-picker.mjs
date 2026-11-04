import assert from 'node:assert/strict';
export async function verifyNativePicker(page, evaluate, capture, closePanel) {
    const panel = async (action = '') => {
        const reply = await evaluate(
            `(async()=>{${action};await new Promise(r=>setTimeout(r,100));return {body:document.body.innerText,selected:document.querySelector('[aria-selected="true"]')?.textContent,selectedId:document.querySelector('[aria-selected="true"]')?.getAttribute('data-node-id'),pressed:[...document.querySelectorAll('button')].find(n=>n.textContent==='Cancel picker')?.getAttribute('aria-pressed')};})()`
        );
        if (reply.result?.exceptionDetails)
            throw Error(JSON.stringify(reply.result.exceptionDetails));
        return reply.result?.result?.value;
    };
    const wait = async (predicate) => {
        let last;
        for (let n = 0; n < 50; n++) {
            last = await panel();
            if (predicate(last)) return last;
        }
        throw Error(`Native picker panel: ${JSON.stringify(last)}`);
    };
    const action = (label) =>
        panel(
            `const button=[...document.querySelectorAll('button')].find(n=>n.textContent===${JSON.stringify(label)});if(!button)throw Error('Missing action');button.click();`
        );
    await panel(
        `[...document.querySelectorAll('a')].find(n=>n.textContent==='Components').click()`
    );
    await wait((s) => s?.body.includes('Pick component'));
    const production = page.url().includes('/production');
    const snapshots = [];
    await panel(
        `const input=[...document.querySelectorAll('label')].find(n=>n.textContent.includes('Tree filter')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'no-match');input.dispatchEvent(new Event('input',{bubbles:true}));`
    );

    for (const [name, target] of [
        ['nested', page.locator('#pick-target span')],
        ['portal', page.locator('#portal-target span')],
        [
            'frame',
            page.frameLocator('#same-frame').locator('#frame-target span')
        ]
    ]) {
        const previousSelected = (await panel()).selectedId;
        await action('Pick component');
        await page.locator('[data-react-devtools-picker]').waitFor();
        await target.hover();
        if (name !== 'frame')
            await page.locator('[data-react-devtools-highlighter]').waitFor();
        await target.click();
        const observed = await wait((s) =>
            production
                ? !s?.pressed &&
                  !!s?.selectedId &&
                  s.selectedId !== previousSelected
                : s?.selected?.includes(
                      name === 'frame' ? 'FrameCard' : 'TargetCard'
                  )
        );
        snapshots.push({ stage: name, ...observed });
        assert.equal(
            await page.locator('[data-react-devtools-picker]').count(),
            0
        );
        assert.equal(
            await page.locator('[data-react-devtools-highlighter]').count(),
            0
        );
    }
    assert.notEqual(
        snapshots[0].selectedId,
        snapshots[1].selectedId,
        'Portal selected a different component with the same name'
    );
    assert.equal(
        await page.locator('#pick-target').innerText(),
        'Nested target 0'
    );
    assert.equal(
        await page.locator('#portal-target').innerText(),
        'Portal target 0'
    );
    await action('Pick component');
    await page.locator('[data-react-devtools-picker]').waitFor();
    await page.frameLocator('#cross-frame').locator('#unmanaged').click();
    assert.equal(
        await page.locator('[data-react-devtools-picker]').count(),
        1,
        'Inaccessible frame changed top-document selection'
    );
    await action('Cancel picker');
    await page
        .locator('[data-react-devtools-picker]')
        .waitFor({ state: 'detached' });
    await page.locator('h1').click();
    for (let i = 0; i < 3; i++) {
        await action('Pick component');
        await page.locator('[data-react-devtools-picker]').waitFor();
        await page.keyboard.press('Escape');
        await wait((s) => !s.pressed);
        assert.equal(
            await page.locator('[data-react-devtools-picker]').count(),
            0
        );
    }
    await action('Pick component');
    await page.locator('[data-react-devtools-picker]').waitFor();
    await action('Cancel picker');
    await page
        .locator('[data-react-devtools-picker]')
        .waitFor({ state: 'detached' });
    await page.locator('#pick-target span').click();
    assert.equal(
        await page.locator('#pick-target').innerText(),
        'Nested target 1'
    );
    // Select actual far-away component; scroll action must move the inspected document.
    await action('Pick component');
    await page.locator('[data-react-devtools-picker]').waitFor();
    await page.locator('#pick-target span').click();
    await wait(
        (s) =>
            !s?.pressed &&
            (production ? !!s?.selectedId : s?.selected?.includes('TargetCard'))
    );
    await panel(
        `document.querySelector('[aria-selected="true"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));`
    );
    await page.locator('[data-react-devtools-highlighter]').waitFor();
    const hoverRects = await page.evaluate(() => ({
        node: document
            .querySelector('#pick-target')
            .getBoundingClientRect()
            .toJSON(),
        overlay: document
            .querySelector('[data-react-devtools-highlighter]')
            .getBoundingClientRect()
            .toJSON()
    }));
    assert.deepEqual(hoverRects.overlay, hoverRects.node);
    await panel(
        `document.querySelector('[aria-selected="true"]').dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));`
    );
    await page
        .locator('[data-react-devtools-highlighter]')
        .waitFor({ state: 'detached' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const scrollBefore = await page.evaluate(() => scrollY);
    await action('Scroll to component');
    assert(
        (await page.evaluate(() => scrollY)) < scrollBefore,
        'Scroll action did not reveal the selected node'
    );
    await page.waitForTimeout(200);
    assert(
        !(await panel()).body.includes('Open source'),
        'Unavailable source action is exposed'
    );
    await capture('picker');
    // Closing the registered panel must dispose active page listeners and overlay.
    await action('Pick component');
    await page.locator('[data-react-devtools-picker]').waitFor();
    await page.reload();
    await page.locator('#pick-target').waitFor();
    assert.equal(await page.locator('[data-react-devtools-picker]').count(), 0);
    await wait((s) => s.body.includes('Pick component') && !s.pressed);
    await action('Pick component');
    await page.locator('[data-react-devtools-picker]').waitFor();
    await closePanel();
    await page
        .locator('[data-react-devtools-picker]')
        .waitFor({ state: 'detached' });
    await page.locator('#pick-target span').click();
    assert.equal(
        await page.locator('#pick-target').innerText(),
        'Nested target 1'
    );
    return {
        snapshots,
        cancellationCycles: 3,
        disconnectCleanup: true,
        applicationClicksSuppressed: true,
        sourceUnavailableHidden: true,
        inaccessibleFrameIsolated: true
    };
}
