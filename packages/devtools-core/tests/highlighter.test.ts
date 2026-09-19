/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />

import {
    ReactFiberTag,
    getBoundingRect,
    highlightElement,
    unhighlightElement
} from '../src/index.js';
import type { ReactFiber } from '../src/index.js';

describe('component highlighter', () => {
    afterEach(() => {
        unhighlightElement();
        document.body.innerHTML = '';
    });

    it('resolves the first host DOM node beneath a component fiber', () => {
        const button = document.createElement('button');
        mockRect(button, createRect(12, 16, 80, 30));

        const app = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent
        });
        const wrapper = createFiberFixture({
            returnFiber: app,
            tag: ReactFiberTag.FunctionComponent
        });
        const host = createFiberFixture({
            returnFiber: wrapper,
            stateNode: button,
            tag: ReactFiberTag.HostComponent,
            type: 'button'
        });

        app.child = wrapper;
        wrapper.child = host;

        expect(getBoundingRect(app)).toEqual({
            bottom: 46,
            height: 30,
            left: 12,
            right: 92,
            top: 16,
            width: 80,
            x: 12,
            y: 16
        });
    });

    it('draws and removes a page overlay matching the resolved host rect', () => {
        const panel = document.createElement('section');
        mockRect(panel, createRect(40, 30, 200, 90));

        const app = createFiberFixture({
            tag: ReactFiberTag.ClassComponent
        });
        const host = createFiberFixture({
            returnFiber: app,
            stateNode: panel,
            tag: ReactFiberTag.HostComponent,
            type: 'section'
        });

        app.child = host;
        document.body.appendChild(panel);

        expect(
            highlightElement(app, { className: 'component-highlight' })
        ).toEqual({
            bottom: 120,
            height: 90,
            left: 40,
            right: 240,
            top: 30,
            width: 200,
            x: 40,
            y: 30
        });

        const overlay = document.querySelector(
            '[data-react-devtools-highlighter="true"]'
        ) as HTMLElement | null;

        expect(overlay).not.toBeNull();
        expect(overlay?.className).toBe('component-highlight');
        expect(overlay?.style.position).toBe('absolute');
        expect(overlay?.style.left).toBe('40px');
        expect(overlay?.style.top).toBe('30px');
        expect(overlay?.style.width).toBe('200px');
        expect(overlay?.style.height).toBe('90px');

        unhighlightElement();

        expect(
            document.querySelector('[data-react-devtools-highlighter="true"]')
        ).toBeNull();
    });

    it('replaces any previous overlay when highlighting a new fiber', () => {
        const first = document.createElement('div');
        const second = document.createElement('article');
        mockRect(first, createRect(0, 0, 20, 20));
        mockRect(second, createRect(10, 12, 30, 40));

        highlightElement(
            createFiberFixture({
                stateNode: first,
                tag: ReactFiberTag.HostComponent
            })
        );
        highlightElement(
            createFiberFixture({
                stateNode: second,
                tag: ReactFiberTag.HostComponent
            })
        );

        const overlays = document.querySelectorAll(
            '[data-react-devtools-highlighter="true"]'
        );

        expect(overlays).toHaveLength(1);
        expect((overlays[0] as HTMLElement).style.left).toBe('10px');
        expect((overlays[0] as HTMLElement).style.top).toBe('12px');
    });

    it('returns null and clears overlays when no host node can be resolved', () => {
        highlightElement(
            createFiberFixture({
                stateNode: document.createElement('div'),
                tag: ReactFiberTag.HostComponent
            })
        );

        expect(
            highlightElement(
                createFiberFixture({
                    tag: ReactFiberTag.FunctionComponent
                })
            )
        ).toBeNull();
        expect(
            document.querySelector('[data-react-devtools-highlighter="true"]')
        ).toBeNull();
    });
});

function createFiberFixture(options: {
    returnFiber?: null | ReactFiber;
    stateNode?: unknown;
    tag: ReactFiberTag;
    type?: unknown;
}): ReactFiber {
    return {
        actualDuration: 0,
        actualStartTime: -1,
        alternate: null,
        child: null,
        childLanes: 0,
        deletions: null,
        dependencies: null,
        elementType: options.type ?? null,
        flags: 0,
        index: 0,
        key: null,
        lanes: 0,
        memoizedProps: null,
        memoizedState: null,
        mode: 1,
        pendingProps: null,
        ref: null,
        return: options.returnFiber ?? null,
        selfBaseDuration: 0,
        sibling: null,
        stateNode: options.stateNode ?? null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: options.type ?? null,
        updateQueue: null
    };
}

function createRect(
    left: number,
    top: number,
    width: number,
    height: number
): DOMRect {
    return {
        bottom: top + height,
        height,
        left,
        right: left + width,
        toJSON: () => ({}),
        top,
        width,
        x: left,
        y: top
    };
}

function mockRect(element: Element, rect: DOMRect): void {
    element.getBoundingClientRect = jest.fn(() => rect);
}
