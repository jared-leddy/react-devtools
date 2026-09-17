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
}

export class FiberWalker {
    public getComponentTree(
        root: ReactFiber | ReactFiberRoot,
        options: FiberWalkerOptions = {}
    ): ComponentTreeNode[] {
        const rootFiber = getRootFiber(root);
        const rootId = options.rootId ?? 'root';

        if (!rootFiber) {
            return [];
        }

        return walkFiberChildren(rootFiber, {
            path: [],
            rootId,
            visited: new Set<ReactFiber>()
        });
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
        case ReactFiberTag.ContextProvider:
            return `${getContextDisplayName(fiber)}.Provider`;
        case ReactFiberTag.ContextConsumer:
            return `${getContextDisplayName(fiber)}.Consumer`;
        case ReactFiberTag.ForwardRef:
            return getForwardRefDisplayName(fiber.type);
        case ReactFiberTag.MemoComponent:
        case ReactFiberTag.SimpleMemoComponent:
            return getMemoDisplayName(fiber.type);
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
    path: number[];
    rootId: string;
    visited: Set<ReactFiber>;
}

function walkFiberChildren(
    fiber: ReactFiber,
    context: WalkContext
): ComponentTreeNode[] {
    const nodes: ComponentTreeNode[] = [];
    let child = fiber.child;
    let childIndex = 0;

    while (child) {
        nodes.push(
            ...walkFiber(child, {
                ...context,
                path: [...context.path, childIndex]
            })
        );
        child = child.sibling;
        childIndex += 1;
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
            id: createComponentId(context.rootId, context.path, fiber),
            key: fiber.key,
            name,
            rootId: context.rootId,
            tags: getFiberTags(fiber),
            type: getComponentTypeLabel(fiber)
        }
    ];
}

function shouldSurfaceFiber(fiber: ReactFiber): boolean {
    return (
        fiber.tag !== ReactFiberTag.HostRoot &&
        fiber.tag !== ReactFiberTag.HostText &&
        fiber.tag !== ReactFiberTag.Fragment &&
        fiber.tag !== ReactFiberTag.Mode
    );
}

function getFiberTags(fiber: ReactFiber): string[] {
    const tags = [getReactFiberTagName(fiber.tag)];

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
        tags.push('suspense');
    }

    if (fiber.tag === ReactFiberTag.OffscreenComponent) {
        tags.push('offscreen');
    }

    return Array.from(new Set(tags));
}

function getComponentTypeLabel(fiber: ReactFiber): string {
    switch (fiber.tag) {
        case ReactFiberTag.HostComponent:
            return 'host';
        case ReactFiberTag.ClassComponent:
            return 'class';
        case ReactFiberTag.FunctionComponent:
            return 'function';
        case ReactFiberTag.ContextProvider:
            return 'context-provider';
        case ReactFiberTag.ContextConsumer:
            return 'context-consumer';
        default:
            return getReactFiberTagName(fiber.tag);
    }
}

export function createFiberComponentId(
    rootId: string,
    path: number[],
    fiber: ReactFiber
): string {
    return createComponentId(rootId, path, fiber);
}

function createComponentId(
    rootId: string,
    path: number[],
    fiber: ReactFiber
): string {
    const pathKey = path.length > 0 ? path.join('.') : '0';
    return `${sanitizeIdPart(rootId)}:${pathKey}:${getFiberTypeSignature(fiber)}`;
}

function getFiberTypeSignature(fiber: ReactFiber): string {
    return [
        getReactFiberTagName(fiber.tag),
        fiber.key ? `key=${fiber.key}` : null,
        getFiberDisplayName(fiber)
    ]
        .filter((part): part is string => part !== null)
        .map(sanitizeIdPart)
        .join(':');
}

function getRootFiber(root: ReactFiber | ReactFiberRoot): null | ReactFiber {
    if ('current' in root) {
        return root.current;
    }

    return root;
}

function getTypeDisplayName(value: unknown): null | string {
    if (typeof value === 'string' && value.trim() !== '') {
        return value;
    }

    if (typeof value === 'function') {
        const record = value as Function & { displayName?: string };
        return record.displayName || record.name || null;
    }

    const record = getRecord(value);
    const displayName = record?.displayName;
    const name = record?.name;

    if (typeof displayName === 'string' && displayName.trim() !== '') {
        return displayName;
    }

    return typeof name === 'string' && name.trim() !== '' ? name : null;
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

function sanitizeIdPart(value: string): string {
    return encodeURIComponent(value.trim()).replaceAll('%', '~');
}

function getRecord(value: unknown): null | Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null
        ? (value as Record<PropertyKey, unknown>)
        : null;
}
