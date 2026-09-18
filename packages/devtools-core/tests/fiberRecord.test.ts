import {
    ReactFiberTag,
    createFiberRootRegistry,
    createFiberWalker
} from '../src/index.js';
import type { ReactFiber, ReactFiberRoot } from '../src/index.js';

describe('FiberRootRecord registry', () => {
    it('creates separate records and non-overlapping instance maps for multiple roots', () => {
        const firstRoot = createFiberRootFixture({
            appName: 'FirstApp',
            childName: 'FirstPanel',
            identifierPrefix: 'first'
        });
        const secondRoot = createFiberRootFixture({
            appName: 'SecondApp',
            childName: 'SecondPanel',
            identifierPrefix: 'second'
        });
        const registry = createFiberRootRegistry();

        const firstRecord = registry.recordCommit(firstRoot);
        const secondRecord = registry.recordCommit(secondRoot);

        expect(registry.records).toHaveLength(2);
        expect(firstRecord.id).not.toBe(secondRecord.id);
        expect(Array.from(firstRecord.instanceMap.keys())).toEqual([
            'fiber-root~3A1:0:FunctionComponent:FirstApp',
            'fiber-root~3A1:0.0:FunctionComponent:FirstPanel'
        ]);
        expect(Array.from(secondRecord.instanceMap.keys())).toEqual([
            'fiber-root~3A2:0:FunctionComponent:SecondApp',
            'fiber-root~3A2:0.0:FunctionComponent:SecondPanel'
        ]);
        expect(
            haveOverlappingEntries(
                firstRecord.instanceMap.keys(),
                secondRecord.instanceMap.keys()
            )
        ).toBe(false);
    });

    it('refreshes an existing record after a root commit', () => {
        const root = createFiberRootFixture({
            appName: 'CounterApp',
            childName: 'InitialPanel'
        });
        const registry = createFiberRootRegistry();
        const initialRecord = registry.recordCommit(root);

        root.current = createHostRootWithChild({
            appName: 'CounterApp',
            childName: 'UpdatedPanel'
        });

        const refreshedRecord = registry.recordCommit(root);

        expect(refreshedRecord).toBe(initialRecord);
        expect(refreshedRecord.rootFiber).toBe(root.current);
        expect(Array.from(refreshedRecord.instanceMap.keys())).toEqual([
            'fiber-root~3A1:0:FunctionComponent:CounterApp',
            'fiber-root~3A1:0.0:FunctionComponent:UpdatedPanel'
        ]);
    });

    it('removes one unmounted root without affecting other active roots', () => {
        const firstRoot = createFiberRootFixture({
            appName: 'FirstApp',
            childName: 'FirstPanel'
        });
        const secondRoot = createFiberRootFixture({
            appName: 'SecondApp',
            childName: 'SecondPanel'
        });
        const registry = createFiberRootRegistry();
        const firstRecord = registry.recordCommit(firstRoot);
        const secondRecord = registry.recordCommit(secondRoot);

        expect(registry.recordUnmount(firstRoot)).toBe(true);

        expect(registry.records).toEqual([secondRecord]);
        expect(registry.getRecord(firstRoot)).toBeNull();
        expect(registry.getRecord(secondRoot)).toBe(secondRecord);
        expect(secondRecord.instanceMap.size).toBe(2);
        expect(secondRecord.instanceMap).not.toBe(firstRecord.instanceMap);
    });

    it('can remove a root from a fiber unmount event payload', () => {
        const root = createFiberRootFixture({
            appName: 'UnmountedApp',
            childName: 'UnmountedPanel'
        });
        const registry = createFiberRootRegistry();
        registry.recordCommit(root);

        const child = root.current.child?.child;

        expect(child).not.toBeNull();
        expect(registry.recordUnmount(child as ReactFiber)).toBe(true);
        expect(registry.records).toEqual([]);
    });

    it('produces instance map ids that match walked component tree ids', () => {
        const root = createFiberRootFixture({
            appName: 'WalkedApp',
            childName: 'WalkedPanel'
        });
        const registry = createFiberRootRegistry();
        const record = registry.recordCommit(root);
        const tree = createFiberWalker().getComponentTree(root, {
            rootId: record.id
        });

        expect(Array.from(record.instanceMap.keys())).toEqual([
            tree[0].id,
            tree[0].children[0].id
        ]);
    });
});

function createFiberRootFixture(options: {
    appName: string;
    childName: string;
    identifierPrefix?: string;
}): ReactFiberRoot {
    return {
        callbackNode: null,
        containerInfo: { nodeType: 1 },
        current: createHostRootWithChild(options),
        finishedWork: null,
        identifierPrefix: options.identifierPrefix ?? '',
        pendingChildren: null,
        pendingLanes: 0,
        tag: 1
    };
}

function createHostRootWithChild(options: {
    appName: string;
    childName: string;
}): ReactFiber {
    const hostRoot = createFiberFixture({ tag: ReactFiberTag.HostRoot });
    const app = createFiberFixture({
        returnFiber: hostRoot,
        tag: ReactFiberTag.FunctionComponent,
        type: createNamedFunction(options.appName)
    });
    const child = createFiberFixture({
        returnFiber: app,
        tag: ReactFiberTag.FunctionComponent,
        type: createNamedFunction(options.childName)
    });

    hostRoot.child = app;
    app.child = child;

    return hostRoot;
}

function createNamedFunction(name: string): () => null {
    return {
        [name]() {
            return null;
        }
    }[name];
}

function createFiberFixture(options: {
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
        stateNode: null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: options.type ?? null,
        updateQueue: null
    };
}

function haveOverlappingEntries<TValue>(
    first: Iterable<TValue>,
    second: Iterable<TValue>
): boolean {
    const firstEntries = new Set(first);

    for (const entry of second) {
        if (firstEntries.has(entry)) {
            return true;
        }
    }

    return false;
}
