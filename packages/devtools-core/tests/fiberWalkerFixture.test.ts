import {
    ReactFiberTag,
    createFiberWalker,
    getHooksStateSection,
    getPropsStateSection
} from '../src/index.js';
import type {
    ComponentTreeNode,
    ReactFiber,
    ReactFiberRoot
} from '../src/index.js';

describe('Phase 0 fiber walker fixture suite', () => {
    it('walks the full demo surface in stable display order', () => {
        const fixture = createPhase0DemoFixture();

        expect(
            summarizeTree(
                createFiberWalker().getComponentTree(fixture.root, {
                    rootId: 'phase-0'
                })
            )
        ).toEqual([
            {
                children: [
                    {
                        children: [
                            {
                                children: [],
                                fiberTag: 'HostComponent',
                                hasChildren: false,
                                id: 'phase-0:0.0.0:HostComponent:button',
                                name: 'button',
                                tags: ['HostComponent', 'host'],
                                type: 'host'
                            }
                        ],
                        fiberTag: 'FunctionComponent',
                        hasChildren: true,
                        id: 'phase-0:0.0:FunctionComponent:StateCounterDemo',
                        name: 'StateCounterDemo',
                        tags: ['FunctionComponent', 'component', 'function'],
                        type: 'function'
                    },
                    {
                        children: [
                            {
                                children: [],
                                fiberTag: 'HostComponent',
                                hasChildren: false,
                                id: 'phase-0:0.1.0:HostComponent:button',
                                name: 'button',
                                tags: ['HostComponent', 'host'],
                                type: 'host'
                            }
                        ],
                        fiberTag: 'FunctionComponent',
                        hasChildren: true,
                        id: 'phase-0:0.1:FunctionComponent:ReducerCounterDemo',
                        name: 'ReducerCounterDemo',
                        tags: ['FunctionComponent', 'component', 'function'],
                        type: 'function'
                    },
                    {
                        children: [
                            {
                                children: [
                                    {
                                        children: [],
                                        fiberTag: 'HostComponent',
                                        hasChildren: false,
                                        id: 'phase-0:0.2.0.0:HostComponent:span',
                                        name: 'span',
                                        tags: ['HostComponent', 'host'],
                                        type: 'host'
                                    }
                                ],
                                contexts: [
                                    {
                                        displayName: 'ThemeContext',
                                        kind: 'dependency',
                                        value: 'dark'
                                    }
                                ],
                                fiberTag: 'FunctionComponent',
                                hasChildren: true,
                                id: 'phase-0:0.2.0:FunctionComponent:ContextReaderDemo',
                                name: 'ContextReaderDemo',
                                tags: [
                                    'FunctionComponent',
                                    'component',
                                    'function'
                                ],
                                type: 'function'
                            }
                        ],
                        contexts: [
                            {
                                displayName: 'ThemeContext',
                                kind: 'provider',
                                value: 'dark'
                            }
                        ],
                        fiberTag: 'ContextProvider',
                        hasChildren: true,
                        id: 'phase-0:0.2:ContextProvider:ThemeContext.Provider',
                        name: 'ThemeContext.Provider',
                        tags: ['ContextProvider', 'context-provider'],
                        type: 'context-provider'
                    },
                    {
                        children: [
                            {
                                children: [],
                                fiberTag: 'HostComponent',
                                hasChildren: false,
                                id: 'phase-0:0.3.0:HostComponent:article',
                                name: 'article',
                                tags: ['HostComponent', 'host'],
                                type: 'host'
                            }
                        ],
                        fiberTag: 'Memo',
                        hasChildren: true,
                        id: 'phase-0:0.3:Memo:MemoPanelDemo',
                        name: 'MemoPanelDemo',
                        tags: ['Memo', 'component', 'memo'],
                        type: 'Memo'
                    },
                    {
                        children: [
                            {
                                children: [
                                    {
                                        children: [],
                                        fiberTag: 'HostComponent',
                                        hasChildren: false,
                                        id: 'phase-0:0.4.0.0:HostComponent:p',
                                        name: 'p',
                                        tags: ['HostComponent', 'host'],
                                        type: 'host'
                                    }
                                ],
                                fiberTag: 'Lazy',
                                hasChildren: true,
                                id: 'phase-0:0.4.0:Lazy:LazyPanelDemo',
                                name: 'LazyPanelDemo',
                                tags: ['Lazy', 'component', 'lazy'],
                                type: 'Lazy'
                            }
                        ],
                        diagnostics: [
                            {
                                displayName: 'Suspense',
                                kind: 'suspense',
                                status: 'resolved'
                            }
                        ],
                        fiberTag: 'Suspense',
                        hasChildren: true,
                        id: 'phase-0:0.4:Suspense:Suspense',
                        name: 'Suspense',
                        tags: ['Suspense', 'boundary', 'suspense'],
                        type: 'suspense'
                    },
                    {
                        children: [
                            {
                                children: [],
                                fiberTag: 'HostComponent',
                                hasChildren: false,
                                id: 'phase-0:0.5.0:HostComponent:section',
                                name: 'section',
                                tags: ['HostComponent', 'host'],
                                type: 'host'
                            }
                        ],
                        fiberTag: 'ClassComponent',
                        hasChildren: true,
                        id: 'phase-0:0.5:ClassComponent:ClassCounterDemo',
                        name: 'ClassCounterDemo',
                        tags: ['ClassComponent', 'component', 'class'],
                        type: 'class'
                    },
                    {
                        children: [
                            {
                                children: [],
                                fiberTag: 'HostComponent',
                                hasChildren: false,
                                id: 'phase-0:0.6.0:HostComponent:pre',
                                name: 'pre',
                                tags: ['HostComponent', 'host'],
                                type: 'host'
                            }
                        ],
                        diagnostics: [
                            {
                                capturedError: 'Error: Demo failure',
                                displayName: 'ErrorBoundaryDemo',
                                kind: 'error-boundary',
                                message: 'Demo failure',
                                status: 'captured'
                            }
                        ],
                        fiberTag: 'ClassComponent',
                        hasChildren: true,
                        id: 'phase-0:0.6:ClassComponent:ErrorBoundaryDemo',
                        name: 'ErrorBoundaryDemo',
                        tags: [
                            'ClassComponent',
                            'component',
                            'class',
                            'error-boundary'
                        ],
                        type: 'class'
                    }
                ],
                fiberTag: 'FunctionComponent',
                hasChildren: true,
                id: 'phase-0:0:FunctionComponent:Phase0DemoSurface',
                name: 'Phase0DemoSurface',
                tags: ['FunctionComponent', 'component', 'function'],
                type: 'function'
            }
        ]);
    });

    it('keeps walked ids stable across a forced rerender', () => {
        const initial = createPhase0DemoFixture({ count: 1, reducedCount: 5 });
        const rerender = createPhase0DemoFixture({
            count: 2,
            reducedCount: 8,
            theme: 'light'
        });

        expect(
            collectIds(
                createFiberWalker().getComponentTree(initial.root, {
                    rootId: 'phase-0'
                })
            )
        ).toEqual(
            collectIds(
                createFiberWalker().getComponentTree(rerender.root, {
                    rootId: 'phase-0'
                })
            )
        );
    });

    it('formats props and hooks state sections for demo components', () => {
        const fixture = createPhase0DemoFixture();

        expect(getPropsStateSection(fixture.stateCounter)).toEqual({
            fields: [
                { name: 'label', value: 'State counter' },
                {
                    name: 'onIncrement',
                    value: {
                        _custom: {
                            display: 'ƒ handleIncrement()',
                            readOnly: true,
                            type: 'function'
                        }
                    }
                }
            ],
            name: 'props'
        });
        expect(getHooksStateSection(fixture.stateCounter)).toEqual({
            fields: [{ name: 'Hook 0 (state)', value: 1 }],
            name: 'hooks'
        });
        expect(getHooksStateSection(fixture.reducerCounter)).toEqual({
            fields: [
                {
                    name: 'Hook 0 (reducer)',
                    value: {
                        _custom: {
                            display: 'Object',
                            type: 'object',
                            value: { count: 5 }
                        }
                    }
                }
            ],
            name: 'hooks'
        });
        expect(getHooksStateSection(fixture.contextReader)).toEqual({
            fields: [{ name: 'Hook 0 (context)', value: 'dark' }],
            name: 'hooks'
        });
        expect(getPropsStateSection(fixture.memoPanel)).toEqual({
            fields: [
                {
                    name: 'items',
                    value: {
                        _custom: {
                            display: 'Array(2)',
                            type: 'array',
                            value: ['alpha', 'beta']
                        }
                    }
                }
            ],
            name: 'props'
        });
    });
});

interface Phase0DemoFixture {
    contextReader: ReactFiber;
    memoPanel: ReactFiber;
    reducerCounter: ReactFiber;
    root: ReactFiberRoot;
    stateCounter: ReactFiber;
}

interface Phase0DemoOptions {
    count?: number;
    reducedCount?: number;
    theme?: string;
}

function createPhase0DemoFixture(
    options: Phase0DemoOptions = {}
): Phase0DemoFixture {
    const count = options.count ?? 1;
    const reducedCount = options.reducedCount ?? 5;
    const theme = options.theme ?? 'dark';
    const themeContext = {
        _currentValue: theme,
        displayName: 'ThemeContext'
    };

    class ClassCounterDemo {
        public state = { count: 3 };
        public setState(): void {}
    }

    class ErrorBoundaryDemo {
        public componentDidCatch(): void {}
    }

    const root = createFiberFixture({ tag: ReactFiberTag.HostRoot });
    const surface = createFiberFixture({
        returnFiber: root,
        tag: ReactFiberTag.FunctionComponent,
        type: function Phase0DemoSurface() {}
    });
    const stateCounter = createFiberFixture({
        memoizedProps: {
            label: 'State counter',
            onIncrement: function handleIncrement() {}
        },
        memoizedState: createHookList({
            memoizedState: count,
            queue: {}
        }),
        returnFiber: surface,
        tag: ReactFiberTag.FunctionComponent,
        type: function StateCounterDemo() {}
    });
    const stateButton = createFiberFixture({
        returnFiber: stateCounter,
        tag: ReactFiberTag.HostComponent,
        type: 'button'
    });
    const reducerCounter = createFiberFixture({
        memoizedState: createHookList({
            memoizedState: { count: reducedCount },
            queue: { lastRenderedReducer: function counterReducer() {} }
        }),
        returnFiber: surface,
        tag: ReactFiberTag.FunctionComponent,
        type: function ReducerCounterDemo() {}
    });
    const reducerButton = createFiberFixture({
        returnFiber: reducerCounter,
        tag: ReactFiberTag.HostComponent,
        type: 'button'
    });
    const provider = createFiberFixture({
        memoizedProps: { value: theme },
        returnFiber: surface,
        tag: ReactFiberTag.ContextProvider,
        type: { _context: themeContext }
    });
    const contextReader = createFiberFixture({
        dependencies: {
            firstContext: {
                context: themeContext,
                memoizedValue: theme,
                next: null
            }
        },
        returnFiber: provider,
        tag: ReactFiberTag.FunctionComponent,
        type: function ContextReaderDemo() {}
    });
    const contextHost = createFiberFixture({
        returnFiber: contextReader,
        tag: ReactFiberTag.HostComponent,
        type: 'span'
    });
    const memoPanel = createFiberFixture({
        memoizedProps: { items: ['alpha', 'beta'] },
        returnFiber: surface,
        tag: ReactFiberTag.MemoComponent,
        type: { type: function MemoPanelDemo() {} }
    });
    const memoHost = createFiberFixture({
        returnFiber: memoPanel,
        tag: ReactFiberTag.HostComponent,
        type: 'article'
    });
    const suspense = createFiberFixture({
        returnFiber: surface,
        tag: ReactFiberTag.SuspenseComponent
    });
    const lazyPanel = createFiberFixture({
        returnFiber: suspense,
        tag: ReactFiberTag.LazyComponent,
        type: {
            _payload: {
                _result: function LazyPanelDemo() {},
                _status: 1
            }
        }
    });
    const lazyHost = createFiberFixture({
        returnFiber: lazyPanel,
        tag: ReactFiberTag.HostComponent,
        type: 'p'
    });
    const classCounter = createFiberFixture({
        memoizedState: { count: 3 },
        returnFiber: surface,
        stateNode: new ClassCounterDemo(),
        tag: ReactFiberTag.ClassComponent,
        type: ClassCounterDemo
    });
    const classHost = createFiberFixture({
        returnFiber: classCounter,
        tag: ReactFiberTag.HostComponent,
        type: 'section'
    });
    const errorBoundary = createFiberFixture({
        memoizedState: { error: new Error('Demo failure') },
        returnFiber: surface,
        stateNode: new ErrorBoundaryDemo(),
        tag: ReactFiberTag.ClassComponent,
        type: ErrorBoundaryDemo
    });
    const errorHost = createFiberFixture({
        returnFiber: errorBoundary,
        tag: ReactFiberTag.HostComponent,
        type: 'pre'
    });

    root.child = surface;
    surface.child = stateCounter;
    stateCounter.child = stateButton;
    stateCounter.sibling = reducerCounter;
    reducerCounter.child = reducerButton;
    reducerCounter.sibling = provider;
    provider.child = contextReader;
    contextReader.child = contextHost;
    provider.sibling = memoPanel;
    memoPanel.child = memoHost;
    memoPanel.sibling = suspense;
    suspense.child = lazyPanel;
    lazyPanel.child = lazyHost;
    suspense.sibling = classCounter;
    classCounter.child = classHost;
    classCounter.sibling = errorBoundary;
    errorBoundary.child = errorHost;

    return {
        contextReader,
        memoPanel,
        reducerCounter,
        root: {
            containerInfo: { nodeType: 1 },
            current: root,
            tag: 1
        },
        stateCounter
    };
}

interface HookFixture {
    memoizedState: unknown;
    next?: null | HookFixture;
    queue?: unknown;
}

function createHookList(firstHook: HookFixture): HookFixture {
    firstHook.next = null;
    return firstHook;
}

function summarizeTree(nodes: ComponentTreeNode[]): unknown[] {
    return nodes.map((node) => ({
        children: summarizeTree(node.children),
        ...(node.contexts && node.contexts.length > 0
            ? { contexts: node.contexts }
            : {}),
        ...(node.diagnostics && node.diagnostics.length > 0
            ? { diagnostics: serializeDiagnostics(node.diagnostics) }
            : {}),
        fiberTag: node.fiberTag,
        hasChildren: node.hasChildren,
        id: node.id,
        name: node.name,
        tags: node.tags,
        type: node.type
    }));
}

function collectIds(nodes: ComponentTreeNode[]): string[] {
    return nodes.flatMap((node) => [node.id, ...collectIds(node.children)]);
}

function serializeDiagnostics(
    diagnostics: ComponentTreeNode['diagnostics']
): unknown[] {
    return (diagnostics ?? []).map((diagnostic) => ({
        ...diagnostic,
        ...(diagnostic.capturedError instanceof Error
            ? { capturedError: String(diagnostic.capturedError) }
            : {})
    }));
}

function createFiberFixture(options: {
    dependencies?: ReactFiber['dependencies'];
    key?: null | string;
    memoizedProps?: unknown;
    memoizedState?: unknown;
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
        dependencies: options.dependencies ?? null,
        elementType: options.type ?? null,
        flags: 0,
        index: 0,
        key: options.key ?? null,
        lanes: 0,
        memoizedProps: options.memoizedProps ?? null,
        memoizedState: options.memoizedState ?? null,
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
