import type { ReactFiber, ReactFiberContextDependency } from '../fiber.js';
import type { ComponentStateSection } from '../types.js';
import { formatDisplayableValue } from '../valueFormat.js';

export interface FiberPropsOptions {
    includeChildren?: boolean;
}

export type FiberHookKind =
    'context' | 'effect' | 'memo' | 'reducer' | 'ref' | 'state' | 'unknown';

export interface FiberHookRecord {
    index: number;
    name: string;
    type: FiberHookKind;
    value: unknown;
}

export type FiberPropsRecord = Record<string, unknown>;

export function getProps(
    fiber: ReactFiber,
    options: FiberPropsOptions = {}
): FiberPropsRecord {
    const props = getPropsRecord(fiber.memoizedProps);

    if (!props) {
        return {};
    }

    const includeChildren = options.includeChildren ?? false;
    const entries = Object.entries(props).filter(
        ([key]) => includeChildren || key !== 'children'
    );

    return Object.fromEntries(entries);
}

export function getPropsStateSection(
    fiber: ReactFiber,
    options: FiberPropsOptions = {}
): ComponentStateSection {
    return {
        fields: Object.entries(getProps(fiber, options)).map(
            ([name, value]) => ({
                name,
                value: formatDisplayableValue(value)
            })
        ),
        name: 'props'
    };
}

export function getHooks(fiber: ReactFiber): FiberHookRecord[] {
    const hooks: FiberHookRecord[] = [];
    let current = fiber.memoizedState;
    const visited = new Set<unknown>();

    while (isRecord(current) && !visited.has(current)) {
        visited.add(current);

        const type = inferHookType(current);
        hooks.push({
            index: hooks.length,
            name: getHookName(hooks.length),
            type,
            value: getHookValue(current, type)
        });

        current = current.next;
    }

    for (const dependency of getContextDependencies(fiber)) {
        hooks.push({
            index: hooks.length,
            name: getHookName(hooks.length),
            type: 'context',
            value: dependency.memoizedValue
        });
    }

    return hooks;
}

export function getHooksStateSection(fiber: ReactFiber): ComponentStateSection {
    return {
        fields: getHooks(fiber).map((hook) => ({
            name: `${hook.name} (${hook.type})`,
            value: formatDisplayableValue(hook.value)
        })),
        name: 'hooks'
    };
}

function getPropsRecord(value: unknown): null | Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function inferHookType(hook: Record<PropertyKey, unknown>): FiberHookKind {
    const memoizedState = hook.memoizedState;

    if (isRecord(hook.queue)) {
        return isReducerQueue(hook.queue) ? 'reducer' : 'state';
    }

    if (isRecord(memoizedState) && 'current' in memoizedState) {
        return 'ref';
    }

    if (Array.isArray(memoizedState) && isDepsArray(memoizedState[1])) {
        return 'memo';
    }

    if (isRecord(memoizedState) && isDepsArray(memoizedState.deps)) {
        return 'effect';
    }

    if ('deps' in hook && isDepsArray(hook.deps)) {
        return 'effect';
    }

    return 'unknown';
}

function getHookValue(
    hook: Record<PropertyKey, unknown>,
    type: FiberHookKind
): unknown {
    const memoizedState = hook.memoizedState;

    if (type === 'memo' && Array.isArray(memoizedState)) {
        return memoizedState[0];
    }

    if (type === 'effect' && isRecord(memoizedState)) {
        return memoizedState.deps ?? memoizedState;
    }

    if (type === 'effect' && isDepsArray(hook.deps)) {
        return hook.deps;
    }

    return memoizedState;
}

function getContextDependencies(
    fiber: ReactFiber
): ReactFiberContextDependency[] {
    const dependencies: ReactFiberContextDependency[] = [];
    let current = fiber.dependencies?.firstContext;
    const visited = new Set<unknown>();

    while (isRecord(current) && !visited.has(current)) {
        visited.add(current);
        dependencies.push(current as ReactFiberContextDependency);
        current = current.next;
    }

    return dependencies;
}

function getHookName(index: number): string {
    return `Hook ${index}`;
}

function isDepsArray(value: unknown): value is unknown[] {
    return Array.isArray(value) || value === null;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

function isReducerQueue(queue: Record<PropertyKey, unknown>): boolean {
    return (
        typeof queue.lastRenderedReducer === 'function' &&
        queue.lastRenderedReducer.name !== 'basicStateReducer'
    );
}
