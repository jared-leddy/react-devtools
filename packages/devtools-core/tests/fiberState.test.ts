import {
    ReactFiberTag,
    getHooks,
    getHooksStateSection,
    getProps,
    getPropsStateSection
} from '../src/index.js';
import type { ReactFiber } from '../src/index.js';

describe('fiber state extraction', () => {
    it('extracts own enumerable props from function components without children by default', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: 'ignored child',
                count: 3,
                enabled: true,
                label: 'Clicks'
            },
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getProps(fiber)).toEqual({
            count: 3,
            enabled: true,
            label: 'Clicks'
        });
    });

    it('extracts props from class components and can include children explicitly', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: ['visible child'],
                mode: 'class',
                title: 'Class widget'
            },
            tag: ReactFiberTag.ClassComponent
        });

        expect(getProps(fiber)).toEqual({
            mode: 'class',
            title: 'Class widget'
        });
        expect(getProps(fiber, { includeChildren: true })).toEqual({
            children: ['visible child'],
            mode: 'class',
            title: 'Class widget'
        });
    });

    it('only returns own enumerable string-keyed props', () => {
        const inheritedProps = { inherited: 'hidden' };
        const props = Object.create(inheritedProps) as Record<string, unknown>;
        Object.defineProperty(props, 'nonEnumerable', {
            enumerable: false,
            value: 'hidden'
        });
        props.visible = 'shown';

        const fiber = createFiberFixture({
            memoizedProps: props,
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getProps(fiber)).toEqual({ visible: 'shown' });
    });

    it('returns an empty props object for non-object memoized props', () => {
        expect(
            getProps(
                createFiberFixture({
                    memoizedProps: null,
                    tag: ReactFiberTag.FunctionComponent
                })
            )
        ).toEqual({});
        expect(
            getProps(
                createFiberFixture({
                    memoizedProps: 'not props',
                    tag: ReactFiberTag.FunctionComponent
                })
            )
        ).toEqual({});
    });

    it('creates a displayable props section', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: 'ignored child',
                label: 'Counter',
                step: 2
            },
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getPropsStateSection(fiber)).toEqual({
            fields: [
                { name: 'label', value: 'Counter' },
                { name: 'step', value: 2 }
            ],
            name: 'props'
        });
    });

    it('extracts state and reducer hooks from the memoized hook list', () => {
        const reducerState = { count: 1 };
        const fiber = createFiberFixture({
            memoizedState: createHookList(
                {
                    memoizedState: 3,
                    queue: {}
                },
                {
                    memoizedState: reducerState,
                    queue: { lastRenderedReducer: function counterReducer() {} }
                }
            ),
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getHooks(fiber)).toEqual([
            { index: 0, name: 'Hook 0', type: 'state', value: 3 },
            {
                index: 1,
                name: 'Hook 1',
                type: 'reducer',
                value: reducerState
            }
        ]);
    });

    it('extracts ref, effect, and memo hooks with best-effort values', () => {
        const ref = { current: { id: 'button' } };
        const deps = ['count'];
        const fiber = createFiberFixture({
            memoizedState: createHookList(
                { memoizedState: ref },
                { memoizedState: { create: jest.fn(), deps, destroy: null } },
                { memoizedState: ['memoized value', ['input']] }
            ),
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getHooks(fiber)).toEqual([
            { index: 0, name: 'Hook 0', type: 'ref', value: ref },
            { index: 1, name: 'Hook 1', type: 'effect', value: deps },
            {
                index: 2,
                name: 'Hook 2',
                type: 'memo',
                value: 'memoized value'
            }
        ]);
    });

    it('extracts useContext dependencies after memoized hook slots', () => {
        const context = { displayName: 'ThemeContext' };
        const fiber = createFiberFixture({
            dependencies: {
                firstContext: {
                    context,
                    memoizedValue: 'dark',
                    next: {
                        context: { displayName: 'LocaleContext' },
                        memoizedValue: 'en-US',
                        next: null
                    }
                }
            },
            memoizedState: createHookList({ memoizedState: 0, queue: {} }),
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getHooks(fiber)).toEqual([
            { index: 0, name: 'Hook 0', type: 'state', value: 0 },
            { index: 1, name: 'Hook 1', type: 'context', value: 'dark' },
            { index: 2, name: 'Hook 2', type: 'context', value: 'en-US' }
        ]);
    });

    it('creates a displayable hooks section with inferred type annotations', () => {
        const fiber = createFiberFixture({
            dependencies: {
                firstContext: {
                    memoizedValue: 'light',
                    next: null
                }
            },
            memoizedState: createHookList(
                { memoizedState: false, queue: {} },
                { memoizedState: { current: null } }
            ),
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getHooksStateSection(fiber)).toEqual({
            fields: [
                { name: 'Hook 0 (state)', value: false },
                { name: 'Hook 1 (ref)', value: { current: null } },
                { name: 'Hook 2 (context)', value: 'light' }
            ],
            name: 'hooks'
        });
    });

    it('stops hook extraction when hook or context dependency lists cycle', () => {
        const hook: HookFixture = {
            memoizedState: 'first',
            next: null,
            queue: {}
        };
        hook.next = hook;
        const contextDependency = {
            memoizedValue: 'cyclic',
            next: null as null | Record<string, unknown>
        };
        contextDependency.next = contextDependency;

        const fiber = createFiberFixture({
            dependencies: { firstContext: contextDependency },
            memoizedState: hook,
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getHooks(fiber)).toEqual([
            { index: 0, name: 'Hook 0', type: 'state', value: 'first' },
            { index: 1, name: 'Hook 1', type: 'context', value: 'cyclic' }
        ]);
    });
});

function createFiberFixture(options: {
    dependencies?: ReactFiber['dependencies'];
    memoizedProps?: unknown;
    memoizedState?: unknown;
    tag: ReactFiberTag;
}): ReactFiber {
    return {
        actualDuration: 0,
        actualStartTime: -1,
        alternate: null,
        child: null,
        childLanes: 0,
        deletions: null,
        dependencies: options.dependencies ?? null,
        elementType: null,
        flags: 0,
        index: 0,
        key: null,
        lanes: 0,
        memoizedProps: options.memoizedProps ?? null,
        memoizedState: options.memoizedState ?? null,
        mode: 1,
        pendingProps: null,
        ref: null,
        return: null,
        selfBaseDuration: 0,
        sibling: null,
        stateNode: null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: null,
        updateQueue: null
    };
}

interface HookFixture {
    memoizedState: unknown;
    next?: null | HookFixture;
    queue?: unknown;
}

function createHookList(
    firstHook: HookFixture,
    ...remainingHooks: HookFixture[]
): HookFixture {
    const hooks = [firstHook, ...remainingHooks];

    for (let index = 0; index < hooks.length; index += 1) {
        hooks[index].next = hooks[index + 1] ?? null;
    }

    return firstHook;
}
