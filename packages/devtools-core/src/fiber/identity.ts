import { ReactFiberTag, type ReactFiber } from '../fiber.js';

interface FiberIdentity {
    id: string;
    retired: boolean;
}

export class FiberIdentityMap {
    private readonly scope = globalThis.crypto.randomUUID();
    private readonly fibers = new WeakMap<ReactFiber, FiberIdentity>();
    private active = new Map<string, FiberIdentity>();
    private next = 0;
    private disposed = false;

    public getId(fiber: ReactFiber): string {
        if (this.disposed) throw new Error('Fiber identity scope disposed');
        const own = this.fibers.get(fiber);
        const alternate = fiber.alternate;
        const isPair =
            alternate?.alternate === fiber &&
            alternate.key === fiber.key &&
            (alternate.elementType ?? alternate.type) ===
                (fiber.elementType ?? fiber.type);
        const paired = isPair ? this.fibers.get(alternate!) : undefined;
        const identity =
            own && !own.retired
                ? own
                : paired && !paired.retired
                  ? paired
                  : {
                        id: `c:${this.scope}:${(++this.next).toString(36)}`,
                        retired: false
                    };
        this.fibers.set(fiber, identity);
        if (isPair && (!paired || paired.retired || paired === identity))
            this.fibers.set(alternate!, identity);
        return identity.id;
    }

    public reconcile(fibers: Iterable<ReactFiber>): Map<string, ReactFiber> {
        const instances = new Map<string, ReactFiber>();
        const active = new Map<string, FiberIdentity>();
        for (const fiber of fibers) {
            const id = this.getId(fiber);
            instances.set(id, fiber);
            active.set(id, this.fibers.get(fiber)!);
        }
        for (const [id, identity] of this.active)
            if (!active.has(id)) identity.retired = true;
        this.active = active;
        return instances;
    }

    public dispose(): void {
        for (const identity of this.active.values()) identity.retired = true;
        this.active.clear();
        this.disposed = true;
    }
}

export function shouldSurfaceFiber(fiber: ReactFiber): boolean {
    return ![
        ReactFiberTag.HostRoot,
        ReactFiberTag.HostText,
        ReactFiberTag.Fragment,
        ReactFiberTag.Mode
    ].includes(fiber.tag);
}
