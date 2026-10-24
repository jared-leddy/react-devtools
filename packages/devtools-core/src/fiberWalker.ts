import {
    ReactFiberTag,
    getReactFiberTagName,
    inspectReactFiberContexts,
    inspectReactFiberDiagnostics,
    isReactContextConsumerFiber,
    isReactContextProviderFiber,
    isReactErrorBoundaryFiber,
    isReactSuspenseFiber,
    type ReactFiber,
    type ReactFiberRoot
} from './fiber.js';
import { FiberIdentityMap, shouldSurfaceFiber } from './fiber/identity.js';
import type { ComponentNode } from './types.js';

export interface ComponentTreeNode extends ComponentNode {
    children: ComponentTreeNode[];
    fiberTag: string;
    hasChildren: boolean;
    name: string;
    tags: string[];
}

export interface FiberWalkerOptions {
    rootId?: string;
    identities?: FiberIdentityMap;
}

export class FiberWalker {
    private readonly scopes = new WeakMap<
        object,
        Map<string, FiberIdentityMap>
    >();
    public getComponentTree(
        root: ReactFiber | ReactFiberRoot,
        options: FiberWalkerOptions = {}
    ): ComponentTreeNode[] {
        const rootFiber = getRootFiber(root);
        const rootId = options.rootId ?? 'root';

        if (!rootFiber) {
            return [];
        }

        let scopes =
            this.scopes.get(root) ??
            this.scopes.get(rootFiber.alternate ?? rootFiber);
        if (!scopes) scopes = new Map();
        this.scopes.set(root, scopes);
        if (rootFiber.alternate) this.scopes.set(rootFiber.alternate, scopes);
        let identities = options.identities ?? scopes.get(rootId);
        if (!identities) {
            identities = new FiberIdentityMap();
            scopes.set(rootId, identities);
        }
        const visited = new Set<ReactFiber>([rootFiber]);
        const nodes = walkFiberChildren(rootFiber, {
            rootId,
            identities,
            visited
        });
        if (!options.identities)
            identities.reconcile([...visited].filter(shouldSurfaceFiber));
        return nodes;
    }
}

export function createFiberWalker(): FiberWalker {
    return new FiberWalker();
}

export function getFiberDisplayName(fiber: ReactFiber): string {
    switch (fiber.tag) {
        case ReactFiberTag.HostRoot:
            return 'Root';
        case ReactFiberTag.HostComponent:
            return getTypeDisplayName(fiber.type) ?? 'HostComponent';
        case ReactFiberTag.HostPortal:
            return 'Portal';
        case ReactFiberTag.ContextProvider:
            return `${getContextDisplayName(fiber)}.Provider`;
        case ReactFiberTag.ContextConsumer:
            return `${getContextDisplayName(fiber)}.Consumer`;
        case ReactFiberTag.ForwardRef:
            return getForwardRefDisplayName(fiber.type);
        case ReactFiberTag.MemoComponent:
        case ReactFiberTag.SimpleMemoComponent:
            return getMemoDisplayName(fiber.elementType ?? fiber.type);
        case ReactFiberTag.LazyComponent:
            return getLazyDisplayName(fiber.type);
        case ReactFiberTag.SuspenseComponent:
            return 'Suspense';
        case ReactFiberTag.OffscreenComponent:
            return 'Offscreen';
        case ReactFiberTag.Profiler:
            return 'Profiler';
        default:
            return (
                getTypeDisplayName(fiber.type) ??
                getTypeDisplayName(fiber.elementType) ??
                'Anonymous'
            );
    }
}

interface WalkContext {
    rootId: string;
    identities: FiberIdentityMap;
    visited: Set<ReactFiber>;
}

function walkFiberChildren(
    fiber: ReactFiber,
    context: WalkContext
): ComponentTreeNode[] {
    const nodes: ComponentTreeNode[] = [];
    let child = fiber.child;
    while (child && !context.visited.has(child)) {
        nodes.push(...walkFiber(child, context));
        child = child.sibling;
    }

    return nodes;
}

function walkFiber(
    fiber: ReactFiber,
    context: WalkContext
): ComponentTreeNode[] {
    if (context.visited.has(fiber)) {
        return [];
    }

    context.visited.add(fiber);

    if (!shouldSurfaceFiber(fiber)) {
        return walkFiberChildren(fiber, context);
    }

    const id = context.identities.getId(fiber);
    const children = walkFiberChildren(fiber, context);
    const name = getFiberDisplayName(fiber);

    return [
        {
            children,
            contexts: inspectReactFiberContexts(fiber),
            diagnostics: inspectReactFiberDiagnostics(fiber),
            displayName: name,
            fiberTag: getReactFiberTagName(fiber.tag),
            hasChildren: children.length > 0,
            id,
            source: getFiberSourceLocation(fiber),
            key: fiber.key,
            name,
            rootId: context.rootId,
            tags: getFiberTags(fiber),
            type: getComponentTypeLabel(fiber)
        }
    ];
}

function getFiberTags(fiber: ReactFiber): string[] {
    const tags = [getReactFiberTagName(fiber.tag)];
    tags.push(
        ...getWrapperTags(fiber.elementType),
        ...getWrapperTags(fiber.type)
    );
    if (fiber.tag === ReactFiberTag.HostPortal) tags.push('portal');

    if (fiber.tag === ReactFiberTag.HostComponent) {
        tags.push('host');
    }

    if (
        fiber.tag === ReactFiberTag.FunctionComponent ||
        fiber.tag === ReactFiberTag.ClassComponent ||
        fiber.tag === ReactFiberTag.ForwardRef ||
        fiber.tag === ReactFiberTag.MemoComponent ||
        fiber.tag === ReactFiberTag.SimpleMemoComponent ||
        fiber.tag === ReactFiberTag.LazyComponent
    ) {
        tags.push('component');
    }

    if (fiber.tag === ReactFiberTag.ClassComponent) {
        tags.push('class');
    }

    if (fiber.tag === ReactFiberTag.FunctionComponent) {
        tags.push('function');
    }

    if (
        fiber.tag === ReactFiberTag.MemoComponent ||
        fiber.tag === ReactFiberTag.SimpleMemoComponent
    ) {
        tags.push('memo');
    }

    if (fiber.tag === ReactFiberTag.ForwardRef) {
        tags.push('forward-ref');
    }

    if (fiber.tag === ReactFiberTag.LazyComponent) {
        tags.push('lazy');
    }

    if (isReactContextProviderFiber(fiber)) {
        tags.push('context-provider');
    }

    if (isReactContextConsumerFiber(fiber)) {
        tags.push('context-consumer');
    }

    if (isReactErrorBoundaryFiber(fiber)) {
        tags.push('error-boundary');
    }

    if (isReactSuspenseFiber(fiber)) {
        tags.push('boundary');
        tags.push('suspense');
    }

    if (fiber.tag === ReactFiberTag.OffscreenComponent) {
        tags.push('boundary');
        tags.push('offscreen');
    }

    return Array.from(new Set(tags));
}

function getWrapperTags(value: unknown, seen = new Set<unknown>()): string[] {
    const record = getRecord(value);
    if (!record || seen.has(value) || seen.size >= 32) return [];
    seen.add(value);
    const kind = record.$$typeof;
    if (kind === Symbol.for('react.memo'))
        return ['memo', ...getWrapperTags(record.type, seen)];
    if (kind === Symbol.for('react.forward_ref')) return ['forward-ref'];
    if (kind === Symbol.for('react.lazy')) {
        const payload = getRecord(record._payload);
        const resolved = payload?._status === 1 ? payload._result : undefined;
        return [
            'lazy',
            ...getWrapperTags(getRecord(resolved)?.default ?? resolved, seen)
        ];
    }
    return [];
}

function getComponentTypeLabel(fiber: ReactFiber): string {
    switch (fiber.tag) {
        case ReactFiberTag.HostComponent:
            return 'host';
        case ReactFiberTag.HostPortal:
            return 'portal';
        case ReactFiberTag.ClassComponent:
            return 'class';
        case ReactFiberTag.FunctionComponent:
            return 'function';
        case ReactFiberTag.ContextProvider:
            return 'context-provider';
        case ReactFiberTag.ContextConsumer:
            return 'context-consumer';
        case ReactFiberTag.SuspenseComponent:
            return 'suspense';
        case ReactFiberTag.OffscreenComponent:
            return 'offscreen';
        default:
            return getReactFiberTagName(fiber.tag);
    }
}

const legacyScopes = new WeakMap<ReactFiber, Map<string, FiberIdentityMap>>();

// Legacy callers may allocate an ID, but must never derive a server ID from a path.
export function createFiberComponentId(
    rootId: string,
    _path: number[],
    fiber: ReactFiber
): string {
    let owner = fiber;
    const visited = new Set<ReactFiber>();
    while (owner.return && !visited.has(owner.return)) {
        visited.add(owner);
        owner = owner.return;
    }
    let scopes =
        legacyScopes.get(owner) ?? legacyScopes.get(owner.alternate ?? owner);
    if (!scopes) scopes = new Map();
    legacyScopes.set(owner, scopes);
    if (owner.alternate) legacyScopes.set(owner.alternate, scopes);
    let identities = scopes.get(rootId);
    if (!identities) {
        identities = new FiberIdentityMap();
        scopes.set(rootId, identities);
    }
    return identities.getId(fiber);
}

function getFiberSourceLocation(fiber: ReactFiber): ComponentNode['source'] {
    const source = fiber._debugSource;
    if (
        !source ||
        typeof source.fileName !== 'string' ||
        !source.fileName.trim() ||
        !Number.isInteger(source.lineNumber) ||
        source.lineNumber! <= 0
    )
        return undefined;
    return {
        fileName: source.fileName,
        lineNumber: source.lineNumber!,
        columnNumber:
            Number.isInteger(source.columnNumber) && source.columnNumber! > 0
                ? source.columnNumber!
                : 0
    };
}

function getRootFiber(root: ReactFiber | ReactFiberRoot): null | ReactFiber {
    if ('current' in root) {
        return root.current;
    }

    return root;
}

function getTypeDisplayName(
    value: unknown,
    seen = new Set<unknown>()
): null | string {
    if (typeof value === 'string') return value.trim() ? value : null;
    if (
        !value ||
        (typeof value !== 'object' && typeof value !== 'function') ||
        seen.has(value) ||
        seen.size >= 32
    )
        return null;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const name of [record.displayName, record.name])
        if (typeof name === 'string' && name.trim()) return name;
    const payload = getRecord(record._payload);
    const resolved = payload?._status === 1 ? payload._result : undefined;
    const module = getRecord(resolved);
    return (
        getTypeDisplayName(record.type, seen) ??
        getTypeDisplayName(record.render, seen) ??
        getTypeDisplayName(module?.default ?? resolved, seen)
    );
}

function getMemoDisplayName(type: unknown): string {
    const record = getRecord(type);
    const displayName = getTypeDisplayName(type);
    const innerName = getTypeDisplayName(record?.type);

    return displayName ?? innerName ?? 'Memo';
}

function getForwardRefDisplayName(type: unknown): string {
    const record = getRecord(type);
    const displayName = getTypeDisplayName(type);
    const renderName = getTypeDisplayName(record?.render);

    return displayName ?? renderName ?? 'ForwardRef';
}

function getLazyDisplayName(type: unknown): string {
    const record = getRecord(type);
    const displayName = getTypeDisplayName(type);
    const payload = getRecord(record?._payload);
    const resolvedType =
        payload && payload._status === 1 ? payload._result : undefined;
    const resolvedName = getTypeDisplayName(resolvedType);

    return displayName ?? resolvedName ?? 'Lazy';
}

function getContextDisplayName(fiber: ReactFiber): string {
    const context =
        getContextRecord(fiber.type) ?? getContextRecord(fiber.elementType);
    const displayName = context?.displayName;

    return typeof displayName === 'string' && displayName.trim() !== ''
        ? displayName
        : 'Context';
}

function getContextRecord(value: unknown): null | Record<PropertyKey, unknown> {
    const record = getRecord(value);
    const nestedContext = getRecord(record?._context);

    if (nestedContext) {
        return nestedContext;
    }

    return record &&
        ('Provider' in record ||
            'Consumer' in record ||
            '_currentValue' in record ||
            '_currentValue2' in record)
        ? record
        : null;
}

function getRecord(value: unknown): null | Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null
        ? (value as Record<PropertyKey, unknown>)
        : null;
}
