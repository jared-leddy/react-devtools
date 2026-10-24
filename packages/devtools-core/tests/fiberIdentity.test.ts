import {
    FiberIdentityMap,
    createFiberComponentId,
    createFiberRootRegistry,
    createFiberWalker,
    getFiberDisplayName,
    ReactFiberTag,
    type ReactFiber,
    type ReactFiberRoot
} from '../src/index.js';

function fiber(
    type: unknown,
    key: string | null = null,
    tag = ReactFiberTag.FunctionComponent
): ReactFiber {
    return {
        type,
        elementType: type,
        key,
        tag,
        alternate: null,
        child: null,
        sibling: null,
        return: null,
        stateNode: null,
        memoizedProps: {},
        memoizedState: null,
        pendingProps: null,
        flags: 0,
        mode: 0,
        index: 0
    };
}
function root(children: ReactFiber[]): ReactFiberRoot {
    const current = fiber(null, null, ReactFiberTag.HostRoot);
    attach(current, children);
    return { current, containerInfo: {}, tag: 1 };
}
function attach(parent: ReactFiber, children: ReactFiber[]) {
    parent.child = children[0] ?? null;
    children.forEach((child, index) => {
        child.return = parent;
        child.sibling = children[index + 1] ?? null;
    });
}
function alternate(current: ReactFiber): ReactFiber {
    const next = { ...current, child: null, sibling: null, alternate: current };
    current.alternate = next;
    return next;
}
const opaque = /^c:[0-9a-f-]{36}:[0-9a-z]+$/;

describe('mounted Fiber identities', () => {
    it('does not encode labels, positions, keys or mutable display names', () => {
        function Row() {}
        const node = fiber(Row, 'private-key');
        const scope = new FiberIdentityMap();
        const id = scope.getId(node);
        expect(id).toMatch(opaque);
        expect(id).not.toMatch(/Row|private-key/);
        Object.assign(Row, { displayName: 'RenamedRow' });
        expect(scope.getId(node)).toBe(id);
        expect(getFiberDisplayName(node)).toBe('RenamedRow');
        expect(createFiberComponentId('root', [1], node)).toBe(
            createFiberComponentId('root', [9, 3], node)
        );
        node.return = node;
        expect(createFiberComponentId('cyclic-parent', [], node)).toMatch(
            opaque
        );
    });
    it('preserves the selected keyed instance through alternate swaps and reorder', () => {
        function Row() {}
        const a = fiber(Row, 'a');
        const b = fiber(Row, 'b');
        const app = root([a, b]);
        const registry = createFiberRootRegistry();
        const record = registry.recordCommit(app);
        const selected = record.identities.getId(b);
        const aId = record.identities.getId(a);
        const nextA = alternate(a);
        const nextB = alternate(b);
        nextB.memoizedProps = { label: 'b', count: 2 };
        const nextRoot = alternate(app.current);
        attach(nextRoot, [nextB, nextA]);
        app.current = nextRoot;
        registry.recordCommit(app);
        const nodes = createFiberWalker().getComponentTree(app, {
            rootId: record.id,
            identities: record.identities
        });
        expect(nodes.map((node) => node.id)).toEqual([selected, aId]);
        expect(record.instanceMap.get(selected)).toBe(nextB);
        expect(record.instanceMap.get(selected)?.memoizedProps).toEqual({
            label: 'b',
            count: 2
        });
        app.current = nextRoot.alternate!;
        registry.recordCommit(app);
        expect(record.instanceMap.get(selected)).toBe(b);
    });
    it('retires removed IDs and never assigns them to same-name remounts or reused objects', () => {
        function Row() {}
        const old = fiber(Row, 'same');
        const app = root([old]);
        const record = createFiberRootRegistry().recordCommit(app);
        const stale = record.identities.getId(old);
        attach(app.current, []);
        record.refresh();
        expect(record.instanceMap.has(stale)).toBe(false);
        const remount = fiber(Row, 'same');
        attach(app.current, [remount]);
        record.refresh();
        expect(record.identities.getId(remount)).not.toBe(stale);
        attach(app.current, []);
        record.refresh();
        attach(app.current, [old]);
        record.refresh();
        expect(record.identities.getId(old)).not.toBe(stale);
    });
    it('isolates roots, renderer-owned registries and fresh producer epochs', () => {
        const node = fiber(function App() {});
        const app = root([node]);
        const first = createFiberRootRegistry({
            createRootId: () => 'same-root-label'
        });
        const other = createFiberRootRegistry({
            createRootId: () => 'same-root-label'
        });
        const record = first.recordCommit(app);
        const stale = record.identities.getId(node);
        expect(other.recordCommit(app).identities.getId(node)).not.toBe(stale);
        expect(first.recordUnmount(app)).toBe(true);
        expect(record.instanceMap.size).toBe(0);
        expect(() => record.identities.getId(node)).toThrow('disposed');
        expect(first.recordCommit(app).identities.getId(node)).not.toBe(stale);
        first.clear();
        expect(first.recordCommit(app).identities.getId(node)).not.toBe(stale);
    });
    it('rejects unrelated or malformed alternate identities', () => {
        const scope = new FiberIdentityMap();
        const a = fiber(function A() {}, 'a');
        const b = fiber(a.type, 'b');
        a.alternate = b;
        b.alternate = a;
        expect(scope.getId(a)).not.toBe(scope.getId(b));
        b.key = 'a';
        const existingA = scope.getId(a);
        const existingB = scope.getId(b);
        expect(existingA).not.toBe(existingB);
        expect(scope.getId(a)).toBe(existingA);
        const differentType = fiber(function Different() {}, 'a');
        differentType.alternate = a;
        a.alternate = differentType;
        expect(scope.getId(differentType)).not.toBe(existingA);
        const unpaired = fiber(a.type, 'a');
        unpaired.alternate = a;
        expect(scope.getId(unpaired)).not.toBe(existingA);
    });
    it('reuses a valid alternate after a retired entry but never a retired pair', () => {
        const scope = new FiberIdentityMap();
        const a = fiber(function A() {});
        const b = alternate(a);
        const first = scope.reconcile([a]).keys().next().value;
        expect(scope.reconcile([b]).keys().next().value).toBe(first);
        scope.reconcile([]);
        expect(scope.reconcile([a]).keys().next().value).not.toBe(first);
        scope.dispose();
        expect(() => scope.reconcile([a])).toThrow('disposed');
    });
    it('keeps a standalone walker scoped and stable across commits and cycles', () => {
        const a = fiber(function A() {});
        const app = root([a]);
        const walker = createFiberWalker();
        const before = walker.getComponentTree(app)[0].id;
        expect(walker.getComponentTree(app)[0].id).toBe(before);
        const next = alternate(app.current);
        const nextA = alternate(a);
        attach(next, [nextA]);
        app.current = next;
        expect(walker.getComponentTree(app)[0].id).toBe(before);
        expect(walker.getComponentTree(next)[0].id).toBe(before);
        expect(
            walker.getComponentTree(app, { rootId: 'other' })[0].id
        ).not.toBe(before);
        nextA.sibling = nextA;
        nextA.child = nextA;
        expect(walker.getComponentTree(app)).toHaveLength(1);
        const registry = createFiberRootRegistry();
        expect(registry.recordCommit(app).instanceMap.size).toBe(1);
        nextA.return = nextA;
        expect(registry.recordUnmount(nextA)).toBe(false);
    });
});

describe('truthful names and wrapper metadata', () => {
    it('unwraps nested memo/forwardRef/lazy without invoking an initializer', () => {
        function AvailableName() {}
        const initialize = jest.fn(() => {
            throw Error('Must not initialize lazy');
        });
        const forward = {
            $$typeof: Symbol.for('react.forward_ref'),
            render: AvailableName
        };
        const memo = { $$typeof: Symbol.for('react.memo'), type: forward };
        const lazy = {
            $$typeof: Symbol.for('react.lazy'),
            _init: initialize,
            _payload: { _status: 1, _result: { default: memo } }
        };
        const node = fiber(lazy, null, ReactFiberTag.LazyComponent);
        expect(getFiberDisplayName(node)).toBe('AvailableName');
        const tree = createFiberWalker().getComponentTree(root([node]));
        expect(tree[0].tags).toEqual(
            expect.arrayContaining(['lazy', 'memo', 'forward-ref'])
        );
        expect(initialize).not.toHaveBeenCalled();
        Object.assign(memo, { displayName: 'ExplicitWrapper' });
        expect(getFiberDisplayName(node)).toBe('ExplicitWrapper');
    });
    it('uses real class/display/short names and honest anonymous fallbacks', () => {
        class RealClass {}
        expect(
            getFiberDisplayName(
                fiber(RealClass, null, ReactFiberTag.ClassComponent)
            )
        ).toBe('RealClass');
        const short = function a() {};
        Object.assign(short, { displayName: '   ' });
        expect(getFiberDisplayName(fiber(short))).toBe('a');
        Object.assign(short, { displayName: 42 });
        expect(getFiberDisplayName(fiber(short))).toBe('a');
        expect(getFiberDisplayName(fiber(null))).toBe('Anonymous');
        const anonymous = () => {};
        Object.defineProperty(anonymous, 'name', { value: '' });
        expect(getFiberDisplayName(fiber(anonymous))).toBe('Anonymous');
        const cycle: { type?: unknown; $$typeof: symbol } = {
            $$typeof: Symbol.for('react.memo')
        };
        cycle.type = cycle;
        expect(
            getFiberDisplayName(fiber(cycle, null, ReactFiberTag.MemoComponent))
        ).toBe('Memo');
        expect(
            getFiberDisplayName(
                fiber(
                    { _payload: { _status: 0 } },
                    null,
                    ReactFiberTag.LazyComponent
                )
            )
        ).toBe('Lazy');
        expect(
            getFiberDisplayName(fiber({}, null, ReactFiberTag.ForwardRef))
        ).toBe('ForwardRef');
    });
    it('preserves provider, consumer, Suspense, portal and available source metadata', () => {
        const context = { displayName: 'ActualTheme', _currentValue: 'dark' };
        const provider = fiber(
            { _context: context },
            null,
            ReactFiberTag.ContextProvider
        );
        const consumer = fiber(
            { _context: context },
            null,
            ReactFiberTag.ContextConsumer
        );
        const suspense = fiber(null, null, ReactFiberTag.SuspenseComponent);
        const portal = fiber(null, null, ReactFiberTag.HostPortal);
        provider._debugSource = { fileName: '/app/Theme.tsx', lineNumber: 12 };
        const nodes = createFiberWalker().getComponentTree(
            root([provider, consumer, suspense, portal])
        );
        expect(nodes.map((node) => node.name)).toEqual([
            'ActualTheme.Provider',
            'ActualTheme.Consumer',
            'Suspense',
            'Portal'
        ]);
        expect(nodes[0].source).toEqual({
            fileName: '/app/Theme.tsx',
            lineNumber: 12,
            columnNumber: 0
        });
        expect(nodes[3].tags).toContain('portal');
        expect(nodes[3].type).toBe('portal');
        provider._debugSource = {
            fileName: '/app/Theme.tsx',
            lineNumber: 12,
            columnNumber: 8
        };
        expect(
            createFiberWalker().getComponentTree(root([provider]))[0].source
                ?.columnNumber
        ).toBe(8);
        provider._debugSource = { fileName: '', lineNumber: 0 };
        expect(
            createFiberWalker().getComponentTree(root([provider]))[0].source
        ).toBeUndefined();
    });
});
