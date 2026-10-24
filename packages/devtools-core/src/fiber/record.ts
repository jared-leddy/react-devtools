import { FiberIdentityMap, shouldSurfaceFiber } from './identity.js';
import {
    ReactFiberTag,
    type ReactFiber,
    type ReactFiberRoot
} from '../fiber.js';

export interface FiberRootRecordOptions {
    id?: string;
}

export class FiberRootRecord {
    public readonly id: string;
    public instanceMap = new Map<string, ReactFiber>();
    public rootFiber: ReactFiber;
    public readonly identities = new FiberIdentityMap();

    public constructor(
        public readonly root: ReactFiberRoot,
        options: FiberRootRecordOptions = {}
    ) {
        this.id = options.id ?? createFallbackRootId(root);
        this.rootFiber = root.current;
        this.refresh();
    }

    public refresh(): this {
        this.rootFiber = this.root.current;
        this.instanceMap = createFiberInstanceMap(
            this.id,
            this.rootFiber,
            this.identities
        );

        return this;
    }

    public dispose(): void {
        this.identities.dispose();
        this.instanceMap.clear();
    }
}

export interface FiberRootRegistryOptions {
    createRootId?: (root: ReactFiberRoot, index: number) => string;
}

export class FiberRootRegistry {
    private readonly createRootId: (
        root: ReactFiberRoot,
        index: number
    ) => string;
    private readonly recordsByRoot = new WeakMap<
        ReactFiberRoot,
        FiberRootRecord
    >();
    private readonly roots: ReactFiberRoot[] = [];
    private nextRootIndex = 0;

    public constructor(options: FiberRootRegistryOptions = {}) {
        this.createRootId =
            options.createRootId ??
            ((_root, index) => `fiber-root:${index.toString(36)}`);
    }

    public get records(): FiberRootRecord[] {
        return this.roots
            .map((root) => this.recordsByRoot.get(root))
            .filter(
                (record): record is FiberRootRecord => record !== undefined
            );
    }

    public get size(): number {
        return this.records.length;
    }

    public clear(): void {
        for (const root of this.roots) {
            this.recordsByRoot.get(root)?.dispose();
            this.recordsByRoot.delete(root);
        }

        this.roots.length = 0;
        this.nextRootIndex = 0;
    }

    public getRecord(root: ReactFiberRoot): null | FiberRootRecord {
        return this.recordsByRoot.get(root) ?? null;
    }

    public recordCommit(root: ReactFiberRoot): FiberRootRecord {
        const currentRecord = this.recordsByRoot.get(root);

        if (currentRecord) {
            return currentRecord.refresh();
        }

        const record = new FiberRootRecord(root, {
            id: this.createRootId(root, ++this.nextRootIndex)
        });

        this.roots.push(root);
        this.recordsByRoot.set(root, record);

        return record;
    }

    public recordUnmount(rootOrFiber: ReactFiber | ReactFiberRoot): boolean {
        const root = this.resolveRoot(rootOrFiber);

        if (!root) {
            return false;
        }

        const rootIndex = this.roots.indexOf(root);

        if (rootIndex === -1) {
            return false;
        }

        this.roots.splice(rootIndex, 1);
        this.recordsByRoot.get(root)?.dispose();
        this.recordsByRoot.delete(root);

        return true;
    }

    private resolveRoot(
        rootOrFiber: ReactFiber | ReactFiberRoot
    ): null | ReactFiberRoot {
        if ('current' in rootOrFiber) {
            return rootOrFiber;
        }

        const rootFiber = findHostRootFiber(rootOrFiber);

        if (!rootFiber) {
            return null;
        }

        return (
            this.roots.find(
                (root) =>
                    root.current === rootFiber ||
                    (root.current.alternate === rootFiber &&
                        rootFiber.alternate === root.current)
            ) ?? null
        );
    }
}

export function createFiberRootRegistry(
    options?: FiberRootRegistryOptions
): FiberRootRegistry {
    return new FiberRootRegistry(options);
}

export function createFiberInstanceMap(
    _rootId: string,
    rootFiber: ReactFiber,
    identities = new FiberIdentityMap()
): Map<string, ReactFiber> {
    const fibers: ReactFiber[] = [];
    collectFiberInstances(rootFiber, fibers, new Set([rootFiber]));
    return identities.reconcile(fibers);
}

function collectFiberInstances(
    fiber: ReactFiber,
    instances: ReactFiber[],
    visited: Set<ReactFiber>
): void {
    let child = fiber.child;
    while (child && !visited.has(child)) {
        visited.add(child);
        if (shouldSurfaceFiber(child)) instances.push(child);
        collectFiberInstances(child, instances, visited);
        child = child.sibling;
    }
}

function findHostRootFiber(fiber: ReactFiber): null | ReactFiber {
    let current: null | ReactFiber = fiber;
    const visited = new Set<ReactFiber>();
    while (current && !visited.has(current)) {
        visited.add(current);
        if (current.tag === ReactFiberTag.HostRoot) {
            return current;
        }

        current = current.return;
    }

    return null;
}

function createFallbackRootId(root: ReactFiberRoot): string {
    const prefix =
        typeof root.identifierPrefix === 'string' &&
        root.identifierPrefix.trim() !== ''
            ? root.identifierPrefix.trim()
            : 'root';

    return `fiber-root:${prefix}`;
}
