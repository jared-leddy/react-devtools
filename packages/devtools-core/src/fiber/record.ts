import { createFiberComponentId } from '../fiberWalker.js';
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
        this.instanceMap = createFiberInstanceMap(this.id, this.rootFiber);

        return this;
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
            this.recordsByRoot.delete(root);
        }

        this.roots.length = 0;
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
            id: this.createRootId(root, this.roots.length + 1)
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

        return this.roots.find((root) => root.current === rootFiber) ?? null;
    }
}

export function createFiberRootRegistry(
    options?: FiberRootRegistryOptions
): FiberRootRegistry {
    return new FiberRootRegistry(options);
}

export function createFiberInstanceMap(
    rootId: string,
    rootFiber: ReactFiber
): Map<string, ReactFiber> {
    const instanceMap = new Map<string, ReactFiber>();

    collectFiberInstances(rootId, rootFiber, [], instanceMap);

    return instanceMap;
}

function collectFiberInstances(
    rootId: string,
    fiber: ReactFiber,
    path: number[],
    instanceMap: Map<string, ReactFiber>
): void {
    let child = fiber.child;
    let childIndex = 0;

    while (child) {
        const childPath = [...path, childIndex];

        if (shouldRecordFiber(child)) {
            instanceMap.set(
                createFiberComponentId(rootId, childPath, child),
                child
            );
        }

        collectFiberInstances(rootId, child, childPath, instanceMap);
        child = child.sibling;
        childIndex += 1;
    }
}

function shouldRecordFiber(fiber: ReactFiber): boolean {
    return (
        fiber.tag !== ReactFiberTag.HostRoot &&
        fiber.tag !== ReactFiberTag.HostText &&
        fiber.tag !== ReactFiberTag.Fragment &&
        fiber.tag !== ReactFiberTag.Mode
    );
}

function findHostRootFiber(fiber: ReactFiber): null | ReactFiber {
    let current: null | ReactFiber = fiber;

    while (current) {
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
