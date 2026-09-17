import {
    FiberWalker,
    ReactFiberTag,
    createFiberComponentId,
    createFiberWalker,
    getFiberDisplayName
} from '../src/index.js';
import type { ReactFiber, ReactFiberRoot } from '../src/index.js';

describe('FiberWalker', () => {
    it('walks surfaced component nodes in DOM order while flattening root and fragments', () => {
        const tree = createKnownTreeFixture();
        const walker = createFiberWalker();

        expect(
            summarizeTree(
                walker.getComponentTree(tree.root, { rootId: 'fixture' })
            )
        ).toEqual([
            {
                children: [
                    {
                        children: [],
                        id: 'fixture:0.0.0:FunctionComponent:HeaderPanel',
                        name: 'HeaderPanel'
                    },
                    {
                        children: [],
                        id: 'fixture:0.0.1:Memo:MemoPanel',
                        name: 'MemoPanel'
                    },
                    {
                        children: [],
                        id: 'fixture:0.0.2:ForwardRef:ForwardedInput',
                        name: 'ForwardedInput'
                    },
                    {
                        children: [],
                        id: 'fixture:0.0.3:Lazy:LazyPanel',
                        name: 'LazyPanel'
                    },
                    {
                        children: [],
                        id: 'fixture:0.0.4:HostComponent:section',
                        name: 'section'
                    }
                ],
                id: 'fixture:0:FunctionComponent:key~3Dapp-key:App',
                name: 'App'
            }
        ]);
    });

    it('sets tree node metadata for ids, keys, children, tags, and fiber type', () => {
        const tree = createKnownTreeFixture();
        const [app] = new FiberWalker().getComponentTree(tree.root, {
            rootId: 'fixture'
        });

        expect(app).toMatchObject({
            fiberTag: 'FunctionComponent',
            hasChildren: true,
            key: 'app-key',
            rootId: 'fixture',
            tags: ['FunctionComponent', 'component', 'function'],
            type: 'function'
        });
        expect(app.children[1]).toMatchObject({
            fiberTag: 'Memo',
            hasChildren: false,
            key: null,
            name: 'MemoPanel',
            tags: ['Memo', 'component', 'memo']
        });
        expect(app.children[2]).toMatchObject({
            name: 'ForwardedInput',
            tags: ['ForwardRef', 'component', 'forward-ref']
        });
        expect(app.children[3]).toMatchObject({
            name: 'LazyPanel',
            tags: ['Lazy', 'component', 'lazy']
        });
        expect(app.children[4]).toMatchObject({
            name: 'section',
            tags: ['HostComponent', 'host'],
            type: 'host'
        });
    });

    it('resolves display names for memo, forwardRef, lazy, classes, and anonymous fibers', () => {
        const memoFiber = createFiberFixture({
            tag: ReactFiberTag.MemoComponent,
            type: { type: function MemoInner() {} }
        });
        const forwardRefFiber = createFiberFixture({
            tag: ReactFiberTag.ForwardRef,
            type: { render: function ForwardedWidget() {} }
        });
        const lazyFiber = createFiberFixture({
            tag: ReactFiberTag.LazyComponent,
            type: {
                _payload: {
                    _result: function LazyWidget() {},
                    _status: 1
                }
            }
        });
        const classFiber = createFiberFixture({
            tag: ReactFiberTag.ClassComponent,
            type: class ClassWidget {}
        });
        const anonymousFiber = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: null
        });

        expect(getFiberDisplayName(memoFiber)).toBe('MemoInner');
        expect(getFiberDisplayName(forwardRefFiber)).toBe('ForwardedWidget');
        expect(getFiberDisplayName(lazyFiber)).toBe('LazyWidget');
        expect(getFiberDisplayName(classFiber)).toBe('ClassWidget');
        expect(getFiberDisplayName(anonymousFiber)).toBe('Anonymous');
    });

    it('keeps function component ids stable across alternate fiber swaps', () => {
        function Counter() {}

        const current = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: Counter
        });
        const workInProgress = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: Counter
        });

        current.alternate = workInProgress;
        workInProgress.alternate = current;

        expect(createFiberComponentId('root', [0, 1], current)).toBe(
            createFiberComponentId('root', [0, 1], workInProgress)
        );
    });

    it('does not reuse ids for different component types at the same tree position', () => {
        function FirstComponent() {}
        function SecondComponent() {}

        const first = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: FirstComponent
        });
        const second = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: SecondComponent
        });

        expect(createFiberComponentId('root', [0], first)).not.toBe(
            createFiberComponentId('root', [0], second)
        );
    });

    it('attaches existing context and diagnostic metadata to surfaced nodes', () => {
        class Boundary {
            public componentDidCatch() {
                return undefined;
            }
        }

        const themeContext = {
            _currentValue: 'quiet',
            displayName: 'ThemeContext'
        };
        const root = createFiberFixture({ tag: ReactFiberTag.HostRoot });
        const provider = createFiberFixture({
            memoizedProps: { value: 'active' },
            returnFiber: root,
            tag: ReactFiberTag.ContextProvider,
            type: { _context: themeContext }
        });
        const suspense = createFiberFixture({
            memoizedState: { retryLane: 1 },
            returnFiber: provider,
            tag: ReactFiberTag.SuspenseComponent
        });
        const boundary = createFiberFixture({
            memoizedState: { error: new Error('Captured') },
            returnFiber: suspense,
            tag: ReactFiberTag.ClassComponent,
            type: Boundary
        });

        root.child = provider;
        provider.child = suspense;
        suspense.child = boundary;

        const [providerNode] = createFiberWalker().getComponentTree(root, {
            rootId: 'metadata'
        });

        expect(providerNode.contexts).toEqual([
            {
                displayName: 'ThemeContext',
                kind: 'provider',
                value: 'active'
            }
        ]);
        expect(providerNode.children[0].diagnostics).toEqual([
            {
                displayName: 'Suspense',
                kind: 'suspense',
                status: 'pending'
            }
        ]);
        expect(providerNode.children[0].children[0].diagnostics).toEqual([
            {
                capturedError: expect.any(Error),
                displayName: 'Boundary',
                kind: 'error-boundary',
                message: 'Captured',
                status: 'captured'
            }
        ]);
    });
});

interface KnownTreeFixture {
    root: ReactFiberRoot;
}

function createKnownTreeFixture(): KnownTreeFixture {
    function App() {}
    function HeaderPanel() {}
    function MemoPanel() {}
    function ForwardedInput() {}
    function LazyPanel() {}

    const hostRoot = createFiberFixture({ tag: ReactFiberTag.HostRoot });
    const app = createFiberFixture({
        key: 'app-key',
        returnFiber: hostRoot,
        tag: ReactFiberTag.FunctionComponent,
        type: App
    });
    const fragment = createFiberFixture({
        returnFiber: app,
        tag: ReactFiberTag.Fragment
    });
    const header = createFiberFixture({
        returnFiber: fragment,
        tag: ReactFiberTag.FunctionComponent,
        type: HeaderPanel
    });
    const text = createFiberFixture({
        returnFiber: header,
        tag: ReactFiberTag.HostText
    });
    const memo = createFiberFixture({
        returnFiber: fragment,
        tag: ReactFiberTag.MemoComponent,
        type: { type: MemoPanel }
    });
    const forwardRef = createFiberFixture({
        returnFiber: fragment,
        tag: ReactFiberTag.ForwardRef,
        type: { render: ForwardedInput }
    });
    const lazy = createFiberFixture({
        returnFiber: fragment,
        tag: ReactFiberTag.LazyComponent,
        type: {
            _payload: {
                _result: LazyPanel,
                _status: 1
            }
        }
    });
    const section = createFiberFixture({
        returnFiber: fragment,
        tag: ReactFiberTag.HostComponent,
        type: 'section'
    });

    hostRoot.child = app;
    app.child = fragment;
    fragment.child = header;
    header.child = text;
    header.sibling = memo;
    memo.sibling = forwardRef;
    forwardRef.sibling = lazy;
    lazy.sibling = section;

    return {
        root: {
            containerInfo: { nodeType: 1 },
            current: hostRoot,
            tag: 1
        }
    };
}

function summarizeTree(
    nodes: Array<{ children: unknown[]; id: string; name: string }>
): Array<{ children: unknown[]; id: string; name: string }> {
    return nodes.map((node) => ({
        children: summarizeTree(
            node.children as Array<{
                children: unknown[];
                id: string;
                name: string;
            }>
        ),
        id: node.id,
        name: node.name
    }));
}

function createFiberFixture(options: {
    key?: null | string;
    memoizedProps?: unknown;
    memoizedState?: unknown;
    returnFiber?: null | ReactFiber;
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
        stateNode: null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: options.type ?? null,
        updateQueue: null
    };
}
