import {
    ReactFiberTag,
    type ReactFiber,
    type ReactFiberContextDependency
} from '../fiber.js';
import type { ComponentStateSection } from '../types.js';
import {
    formatDisplayableValue,
    createDisplayableValueFormatter,
    unavailableValue
} from '../valueFormat.js';

export interface FiberPropsOptions {
    includeChildren?: boolean;
}

export type FiberHookKind =
    | 'context'
    | 'effect'
    | 'memo'
    | 'reducer'
    | 'ref'
    | 'state'
    | 'state-or-reducer'
    | 'unknown';

export interface FiberHookRecord {
    unavailable?: boolean;
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
    const entries = Object.keys(props)
        .filter((key) => includeChildren || key !== 'children')
        .map((key) => {
            const descriptor = Object.getOwnPropertyDescriptor(props, key);
            return [
                key,
                descriptor && 'value' in descriptor
                    ? descriptor.value
                    : unavailableValue('[Accessor not evaluated]')
            ];
        });

    return Object.fromEntries(entries);
}

export function getPropsStateSection(
    fiber: ReactFiber,
    options: FiberPropsOptions = {},
    format = formatDisplayableValue
): ComponentStateSection {
    return {
        fields: Object.keys(getPropsRecord(fiber.memoizedProps) ?? {})
            .filter((name) => options.includeChildren || name !== 'children')
            .slice(0, 50)
            .map((name) => {
                const descriptor = Object.getOwnPropertyDescriptor(
                    fiber.memoizedProps,
                    name
                );
                return {
                    name,
                    value:
                        descriptor && 'value' in descriptor
                            ? format(descriptor.value)
                            : unavailableValue('[Accessor not evaluated]')
                };
            }),
        name: 'props'
    };
}

export function getHooks(fiber: ReactFiber): FiberHookRecord[] {
    if (
        ![
            ReactFiberTag.FunctionComponent,
            ReactFiberTag.ForwardRef,
            ReactFiberTag.SimpleMemoComponent,
            ReactFiberTag.MemoComponent
        ].includes(fiber.tag)
    )
        return [];
    const hooks: FiberHookRecord[] = [];
    let current = fiber.memoizedState;
    const visited = new Set<unknown>();
    const debugTypes = (fiber as ReactFiber & { _debugHookTypes?: string[] })
        ._debugHookTypes;
    const slotTypes =
        Array.isArray(debugTypes) &&
        debugTypes.every((type) =>
            [
                'useState',
                'useReducer',
                'useRef',
                'useMemo',
                'useCallback',
                'useEffect',
                'useLayoutEffect',
                'useInsertionEffect',
                'useContext',
                'useDebugValue'
            ].includes(type)
        )
            ? debugTypes.filter(
                  (type) => type !== 'useContext' && type !== 'useDebugValue'
              )
            : [];
    const kinds: Record<string, FiberHookKind> = {
        useState: 'state',
        useReducer: 'reducer',
        useRef: 'ref',
        useMemo: 'memo',
        useCallback: 'memo',
        useEffect: 'effect',
        useLayoutEffect: 'effect',
        useInsertionEffect: 'effect'
    };

    while (isRecord(current) && !visited.has(current) && hooks.length < 100) {
        visited.add(current);

        const type = kinds[slotTypes[hooks.length]] ?? inferHookType(current);
        hooks.push({
            ...(!('memoizedState' in current) ? { unavailable: true } : {}),
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

export function getHooksStateSection(
    fiber: ReactFiber,
    format = formatDisplayableValue
): ComponentStateSection {
    return {
        fields: getHooks(fiber)
            .filter((hook) => hook.type !== 'context')
            .map((hook) => ({
                name: `${hook.name} (${hook.type})`,
                value: hook.unavailable
                    ? unavailableValue('[Hook value not recorded]')
                    : format(hook.value)
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
        return typeof hook.queue.lastRenderedReducer === 'function' &&
            hook.queue.lastRenderedReducer.name === 'basicStateReducer'
            ? 'state'
            : 'state-or-reducer';
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

    while (
        isRecord(current) &&
        !visited.has(current) &&
        dependencies.length < 100
    ) {
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

export function getComponentStateSections(
    fiber: ReactFiber
): ComponentStateSection[] {
    const sections: ComponentStateSection[] = [];
    const format = createDisplayableValueFormatter({
        maxNodes: 1000,
        maxStringLength: 2000
    });
    try {
        const props = getPropsStateSection(fiber, {}, format);
        const count = Object.keys(getProps(fiber)).length;
        sections.push({
            ...props,
            status: count > 50 ? 'truncated' : 'available',
            ...(count > 50 ? { notice: 'Props truncated to 50 fields.' } : {})
        });
    } catch {
        sections.push({
            name: 'props',
            fields: [],
            status: 'unavailable',
            notice: 'Props unavailable.'
        });
    }
    const isFunction = [
        ReactFiberTag.FunctionComponent,
        ReactFiberTag.ForwardRef,
        ReactFiberTag.SimpleMemoComponent,
        ReactFiberTag.MemoComponent
    ].includes(fiber.tag);
    if (isFunction) {
        const hooks = getHooksStateSection(fiber, format);
        sections.push({
            ...hooks,
            status: hooks.fields.length >= 100 ? 'truncated' : 'available',
            notice: 'Observed hook slots. Custom-hook and variable names are unavailable; state/reducer kinds may be ambiguous. Server metadata is unavailable.'
        });
    }
    if (fiber.tag === ReactFiberTag.ClassComponent) {
        const state = fiber.memoizedState;
        const formatted = format(state);
        sections.push({
            name: 'state',
            status: 'available',
            fields: [{ name: 'Class state', value: formatted }]
        });
    }
    const fields = getContextDependencies(fiber)
        .slice(0, 100)
        .map((dependency, index) => ({
            name: `${isRecord(dependency.context) && typeof dependency.context.displayName === 'string' ? dependency.context.displayName : 'Context'} ${index}`,
            value:
                'memoizedValue' in dependency
                    ? format(dependency.memoizedValue)
                    : unavailableValue('[Context value not recorded]')
        }));
    if (fiber.tag === ReactFiberTag.ContextProvider)
        fields.unshift({
            name: 'Provided value',
            value: format(getProps(fiber, { includeChildren: true }).value)
        });
    if (fields.length)
        sections.push({
            name: 'context',
            fields,
            status: fields.length >= 100 ? 'truncated' : 'available',
            ...(fields.length >= 100
                ? { notice: 'Context inspection limited to 100 dependencies.' }
                : {})
        });
    else if (fiber.tag === ReactFiberTag.ContextConsumer)
        sections.push({
            name: 'context',
            fields: [],
            status: 'unavailable',
            notice: 'This renderer did not record the consumed context value.'
        });
    return sections;
}
