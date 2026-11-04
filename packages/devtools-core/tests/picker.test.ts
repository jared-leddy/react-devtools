/** @jest-environment jsdom */
/// <reference lib="dom" />
import {
    createPagePicker,
    resolveInspectTarget,
    type PickerDocument
} from '../src/picker.js';
import { createFiberRootRegistry } from '../src/fiber/record.js';
import { ReactFiberTag, type ReactFiber } from '../src/fiber.js';

function fixture(doc = document) {
    function PickedCard() {}
    const element = doc.createElement('button');
    element.innerHTML = '<span>nested</span>';
    doc.body.append(element);
    const root = { tag: ReactFiberTag.HostRoot } as ReactFiber;
    const card = {
        tag: ReactFiberTag.FunctionComponent,
        type: PickedCard,
        return: root
    } as ReactFiber;
    const host = {
        tag: ReactFiberTag.HostComponent,
        type: 'button',
        stateNode: element,
        return: card
    } as ReactFiber;
    root.child = card;
    card.child = host;
    const registry = createFiberRootRegistry();
    const record = registry.recordCommit({ current: root, tag: 1 });
    const select = jest.fn();
    const cancel = jest.fn();
    const hover = jest.fn();
    const picker = createPagePicker({
        document: document as unknown as PickerDocument,
        registry,
        refresh: jest.fn(),
        select,
        cancel,
        hover
    });
    return { element, registry, record, card, picker, select, cancel, hover };
}
afterEach(() => {
    document.body.innerHTML = '';
});
it('resolves nested DOM to current component identity and rejects unrelated or retired nodes', () => {
    const { element, registry, record, card } = fixture();
    const result = resolveInspectTarget(registry, element.firstChild!);
    expect(result?.fiber).toBe(card);
    expect(record.instanceMap.get(result!.target.componentId!)).toBe(card);
    expect(resolveInspectTarget(registry, document.body)).toBeUndefined();
    registry.clear();
    expect(resolveInspectTarget(registry, element)).toBeUndefined();
});
it('captures hover and selection, suppresses app clicks, and removes all residue', () => {
    const { element, picker, select, hover } = fixture();
    const appClick = jest.fn();
    element.addEventListener('click', appClick);
    picker.start();
    element.firstChild!.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true })
    );
    expect(hover).toHaveBeenLastCalledWith(
        expect.objectContaining({ componentId: expect.any(String) })
    );
    expect(
        document.querySelector('[data-react-devtools-highlighter]')
    ).not.toBeNull();
    element.click();
    expect(select).toHaveBeenCalledTimes(1);
    expect(appClick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-react-devtools-picker]')).toBeNull();
    expect(
        document.querySelector('[data-react-devtools-highlighter]')
    ).toBeNull();
    element.click();
    expect(appClick).toHaveBeenCalledTimes(1);
    picker.stop();
});
it('cancels repeatedly with Escape and releases listeners on explicit stop', () => {
    const { element, picker, select, cancel } = fixture();
    for (let n = 0; n < 4; n++) {
        picker.start();
        picker.start();
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'a', bubbles: true })
        );
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
                cancelable: true
            })
        );
    }
    expect(cancel).toHaveBeenCalledTimes(4);
    picker.start();
    picker.stop();
    element.click();
    expect(select).not.toHaveBeenCalled();
    expect(document.querySelector('[data-react-devtools-picker]')).toBeNull();
});
it('does not select unmanaged targets and clears hover', () => {
    const { picker, select, hover } = fixture();
    picker.start();
    document.body.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true })
    );
    document.body.click();
    expect(select).not.toHaveBeenCalled();
    expect(hover).not.toHaveBeenCalled();
    picker.stop();
});
it('picks a portal host in an accessible frame and removes frame listeners', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const { element, picker, select, card, record } = fixture(
        frame.contentDocument!
    );
    const portal = {
        tag: ReactFiberTag.HostPortal,
        return: card,
        child: card.child
    } as ReactFiber;
    card.child!.return = portal;
    card.child = portal;
    record.refresh();
    picker.start();
    element.click();
    expect(select).toHaveBeenCalledTimes(1);
    element.click();
    expect(select).toHaveBeenCalledTimes(1);
    picker.stop();
});
it('cleans up after a style-policy failure and rejects missing documents', () => {
    const { picker } = fixture();
    const style = jest
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ position: 'static' } as CSSStyleDeclaration);
    expect(() => picker.start()).toThrow('policy');
    expect(document.querySelector('[data-react-devtools-picker]')).toBeNull();
    style.mockRestore();
    expect(() =>
        createPagePicker({
            registry: createFiberRootRegistry(),
            refresh() {},
            select() {},
            hover() {},
            cancel() {}
        }).start()
    ).toThrow('inaccessible');
});

it('keeps its own overlay toolbar and client iframe interactive', () => {
    const { picker, select } = fixture();
    const toolbar = document.createElement('div');
    toolbar.dataset.reactDevtoolsOverlay = 'true';
    const button = document.createElement('button');
    toolbar.append(button);
    document.body.append(toolbar);
    const client = document.createElement('iframe');
    client.dataset.reactDevtoolsIframe = 'true';
    toolbar.append(client);
    const clientButton = client.contentDocument!.createElement('button');
    client.contentDocument!.body.append(clientButton);
    const appClick = jest.fn();
    button.addEventListener('click', appClick);
    clientButton.addEventListener('click', appClick);
    picker.start();
    button.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button.click();
    clientButton.click();
    expect(appClick).toHaveBeenCalledTimes(2);
    expect(select).not.toHaveBeenCalled();
    picker.stop();
});

it('resolves a bailed-out host return path through a reciprocal owner alternate', () => {
    const { registry, record, card, element } = fixture();
    const alternate = { ...card, alternate: card };
    card.alternate = alternate;
    card.child!.return = alternate;
    record.refresh();
    const match = resolveInspectTarget(registry, element.firstChild!);
    expect(match?.fiber).toBe(card);
    expect(record.instanceMap.get(match!.target.componentId!)).toBe(card);
});
