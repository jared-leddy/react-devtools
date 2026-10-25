import {
    createDevToolsCoreServerFunctions,
    type DevToolsCoreServerFunctions
} from './rpc.js';
import {
    createDevToolsCoreStateStore,
    createInitialDevToolsCoreState,
    type DevToolsCoreStateStore
} from './state.js';
import { createDevToolsUpdatePublisher } from './updates.js';
import { createFiberRootRegistry } from './fiber/record.js';
import { createFiberWalker } from './fiberWalker.js';
import { getComponentStateSections } from './fiber/state.js';
import {
    getBoundingRect,
    highlightElement,
    unhighlightElement
} from './highlighter.js';
import {
    inspectReactFiberContexts,
    inspectReactFiberDiagnostics,
    validateReactFiberRoot,
    validateReactRenderer,
    type ReactFiber
} from './fiber.js';
import type {
    ComponentNode,
    ComponentStateResponse,
    FiberRootEventRecord,
    RendererRecord
} from './types.js';
import {
    createDevToolsHook,
    createRpcServer,
    type RpcChannel,
    isCompatibleReactHook,
    REACT_DEVTOOLS_GLOBAL_HOOK_KEY,
    type ReactDevToolsGlobalHook,
    type ReactDevToolsHookEventMap
} from '@devtools/kit';

const USER_APP_TARGET_ID = 'top';
const USER_APP_SERVER_ID = 'react-devtools-extension-user-app';

export interface UserAppRpcServerBootstrapResult {
    didOpenRpcServer: boolean;
    hookMode: 'disabled' | 'installed' | 'missing' | 'wrapped';
    rendererCount: number;
    rootCount: number;
    dispose?: () => void;
}

interface UserAppWindow {
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
    [REACT_DEVTOOLS_GLOBAL_HOOK_KEY]?: unknown;
}

export function createPageBackend(
    target: UserAppWindow,
    channel: RpcChannel,
    singletonKey?: symbol
): UserAppRpcServerBootstrapResult {
    const owner = target as UserAppWindow & {
        [key: symbol]: UserAppRpcServerBootstrapResult | undefined;
    };
    if (singletonKey && owner[singletonKey]) return owner[singletonKey]!;
    const hookInstallation = resolveReactDevToolsHook(target);

    if (!hookInstallation.hook) {
        return {
            didOpenRpcServer: false,
            hookMode: hookInstallation.mode,
            rendererCount: 0,
            rootCount: 0
        };
    }

    const store = createDevToolsCoreStateStore();
    const registry = createFiberRootRegistry({
        createRootId: (_root, index) => `react-root:${index.toString(36)}`
    });
    const walker = createFiberWalker();
    let stopHooks: (() => void) | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const flushRefresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = undefined;
        refreshRootsAndComponents({ registry, store, walker });
    };
    const scheduleRefresh = () => {
        refreshTimer ??= setTimeout(flushRefresh, 0);
    };
    const updates = createDevToolsUpdatePublisher({
        store,
        projectState: () => createSessionState(store),
        publish: (update) => server.broadcast.notifySessionUpdated(update),
        onActiveChange(active) {
            clearTimeout(refreshTimer);
            refreshTimer = undefined;
            stopHooks?.();
            stopHooks = undefined;
            if (!active) {
                registry.clear();
                store.setComponents([]);
                store.update({ componentState: {} });
                return;
            }
            registry.clear();
            store.update({
                roots: [],
                selectedRootId: null,
                selectedComponentId: null
            });
            stopHooks = subscribeToHookEvents({
                hook: hookInstallation.hook!,
                registry,
                store,
                walker,
                scheduleRefresh
            });
            syncHookSnapshot({
                hook: hookInstallation.hook!,
                registry,
                store,
                walker,
                scheduleRefresh
            });
            flushRefresh();
        }
    });
    const serverFunctions = createUserAppServerFunctions(
        store,
        registry,
        updates,
        flushRefresh,
        () => refreshTimer !== undefined
    );

    const server = createRpcServer<
        import('@devtools/core').DevToolsCoreClientFunctions,
        DevToolsCoreServerFunctions
    >(serverFunctions, {
        channel,
        options: { timeout: 5000 },
        onDisconnect: () => updates.suspend()
    });
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        if (singletonKey && owner[singletonKey] === result)
            delete owner[singletonKey];
        updates.dispose();
        server.dispose();
        target.removeEventListener('pagehide', dispose);
    };
    target.addEventListener('pagehide', dispose);

    const result = {
        didOpenRpcServer: true,
        hookMode: hookInstallation.mode,
        rendererCount: hookInstallation.hook.renderers.size,
        rootCount: [...hookInstallation.hook.renderers.keys()].reduce(
            (count, id) =>
                count + hookInstallation.hook!.getFiberRoots(id).size,
            0
        ),
        dispose
    };
    if (singletonKey) owner[singletonKey] = result;
    return result;
}

function resolveReactDevToolsHook(target: UserAppWindow): {
    hook: ReactDevToolsGlobalHook | null;
    mode: UserAppRpcServerBootstrapResult['hookMode'];
} {
    const existingHook = target[REACT_DEVTOOLS_GLOBAL_HOOK_KEY];

    if (isCompatibleReactHook(existingHook)) {
        return {
            hook: existingHook,
            mode: 'wrapped'
        };
    }

    if (existingHook !== undefined) {
        return {
            hook: null,
            mode: 'disabled'
        };
    }

    const installation = createDevToolsHook({ target });

    return {
        hook: installation.hook,
        mode: installation.mode
    };
}

function createUserAppServerFunctions(
    store: DevToolsCoreStateStore,
    registry: ReturnType<typeof createFiberRootRegistry>,
    updates: ReturnType<typeof createDevToolsUpdatePublisher>,
    flushRefresh: () => void,
    hasPendingRefresh: () => boolean
): DevToolsCoreServerFunctions {
    const coreFunctions = createDevToolsCoreServerFunctions(
        store,
        USER_APP_SERVER_ID,
        updates
    );

    return {
        ...coreFunctions,
        handshake(request) {
            const response = coreFunctions.handshake(request);
            return {
                ...response,
                capabilities: {
                    ...response.capabilities,
                    components: true,
                    componentState: true
                },
                state: createSessionState(store)
            };
        },
        getComponents(request) {
            if (hasPendingRefresh()) flushRefresh();
            return coreFunctions.getComponents(request);
        },
        getComponentState(request) {
            if (hasPendingRefresh()) flushRefresh();
            const fiber = registry.records
                .find((record) => record.id === request.rootId)
                ?.instanceMap.get(request.componentId);
            return fiber
                ? createComponentStateResponse(
                      request.componentId,
                      request.rootId,
                      fiber
                  )
                : undefined;
        },
        highlightComponent(request) {
            if (hasPendingRefresh()) flushRefresh();
            const fiber = registry.records
                .find((record) => record.id === request.rootId)
                ?.instanceMap.get(request.componentId);

            if (!fiber) {
                unhighlightElement();

                return store.update({ highlightedComponentId: null });
            }

            highlightElement(fiber);

            return coreFunctions.highlightComponent(request);
        }
    };
}

function createSessionState(store: DevToolsCoreStateStore) {
    const state = store.getState();
    // Raw Fiber values need the inspection serializer before crossing a port.
    return {
        ...createInitialDevToolsCoreState(),
        renderers: state.renderers,
        roots: state.roots,
        components: state.components.map(projectComponent),
        selectedComponentId: state.selectedComponentId,
        selectedRootId: state.selectedRootId,
        performance: state.performance,
        diagnostics: state.diagnostics
            .slice(-100)
            .map(({ details: _details, ...diagnostic }) => diagnostic),
        rootEvents: state.rootEvents.slice(-100),
        transportStatus: state.transportStatus
    };
}

function projectComponent(node: ComponentNode): ComponentNode {
    return {
        ...node,
        children: node.children?.map(projectComponent),
        contexts: node.contexts?.map(
            ({ value: _value, ...context }) => context
        ),
        diagnostics: node.diagnostics?.map(
            ({ capturedError: _error, ...diagnostic }) => diagnostic
        )
    };
}

function syncHookSnapshot({
    hook,
    registry,
    store,
    walker,
    scheduleRefresh
}: {
    hook: ReactDevToolsGlobalHook;
    registry: ReturnType<typeof createFiberRootRegistry>;
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
    scheduleRefresh: () => void;
}): void {
    store.setRenderers(createRendererRecords(hook, store));

    for (const rendererId of hook.renderers.keys()) {
        for (const root of hook.getFiberRoots(rendererId)) {
            recordCommittedRoot({
                lifecycle: 'added',
                rendererId,
                registry,
                root,
                source: 'getFiberRoots',
                store,
                walker,
                scheduleRefresh
            });
        }
    }
}

function subscribeToHookEvents({
    hook,
    registry,
    store,
    walker,
    scheduleRefresh
}: {
    hook: ReactDevToolsGlobalHook;
    registry: ReturnType<typeof createFiberRootRegistry>;
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
    scheduleRefresh: () => void;
}): () => void {
    const off: Array<() => void> = [];
    const on = <K extends keyof ReactDevToolsHookEventMap>(
        event: K,
        listener: (payload: ReactDevToolsHookEventMap[K]) => void
    ) => {
        hook.on(event, listener);
        off.push(() => hook.off(event, listener));
    };
    on('renderer', () => {
        store.setRenderers(createRendererRecords(hook, store));
    });
    on('commit-fiber-root', (event) => {
        recordCommittedRoot({
            didError: event.didError,
            lifecycle: 'committed',
            priorityLevel: event.priorityLevel,
            rendererId: event.rendererID,
            registry,
            root: event.root,
            source: 'onCommitFiberRoot',
            store,
            walker,
            scheduleRefresh
        });
    });
    on('post-commit-fiber-root', (event) => {
        recordCommittedRoot({
            lifecycle: 'updated',
            rendererId: event.rendererID,
            registry,
            root: event.root,
            source: 'onPostCommitFiberRoot',
            store,
            walker,
            scheduleRefresh
        });
    });
    on('commit-fiber-unmount', () => scheduleRefresh());
    return () => off.forEach((unsubscribe) => unsubscribe());
}

function createRendererRecords(
    hook: ReactDevToolsGlobalHook,
    store: DevToolsCoreStateStore
): RendererRecord[] {
    return Array.from(hook.renderers.entries())
        .filter(([id]) => {
            const roots = [...hook.getFiberRoots(id)];
            return (
                !roots.length ||
                roots.some(
                    (root) =>
                        (root.containerInfo as { id?: string } | undefined)
                            ?.id !== '__react-devtools-overlay__'
                )
            );
        })
        .map(([id, renderer]) => {
            const validation = validateReactRenderer(renderer, {
                rendererId: id,
                targetId: USER_APP_TARGET_ID,
                timestamp: Date.now()
            });
            if (!validation.ok)
                validation.diagnostics.forEach((diagnostic) =>
                    store.reportDiagnostic(diagnostic)
                );
            const rendererRecord = validation.ok ? validation.value : renderer;

            return {
                bundleType: getNumber(rendererRecord.bundleType),
                capabilities: {
                    hasFiberRoots: true,
                    hasRendererInterface: hook.rendererInterfaces.has(id),
                    supportsProfiling: true
                },
                detectedAt: Date.now(),
                id,
                name: getString(
                    rendererRecord.rendererPackageName,
                    rendererRecord.packageName,
                    'react-renderer'
                ),
                packageName: getString(
                    rendererRecord.rendererPackageName,
                    rendererRecord.packageName
                ),
                targetId: USER_APP_TARGET_ID,
                version: getString(rendererRecord.version)
            };
        });
}

function recordCommittedRoot({
    didError,
    lifecycle,
    priorityLevel,
    rendererId,
    registry,
    root,
    source,
    store,
    scheduleRefresh
}: {
    didError?: boolean;
    lifecycle: FiberRootEventRecord['lifecycle'];
    priorityLevel?: unknown;
    rendererId: number;
    registry: ReturnType<typeof createFiberRootRegistry>;
    root: ReactDevToolsHookEventMap['commit-fiber-root']['root'];
    source: FiberRootEventRecord['source'];
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
    scheduleRefresh: () => void;
}): void {
    const validation = validateReactFiberRoot(root, {
        rendererId,
        targetId: USER_APP_TARGET_ID,
        timestamp: Date.now()
    });

    if (
        (root.containerInfo as { id?: string } | undefined)?.id ===
        '__react-devtools-overlay__'
    )
        return;

    if (!validation.ok) {
        for (const diagnostic of validation.diagnostics) {
            store.reportDiagnostic(diagnostic);
        }

        return;
    }

    const rootState = validation.value.current.memoizedState;
    if (
        rootState &&
        typeof rootState === 'object' &&
        'element' in rootState &&
        rootState.element === null
    ) {
        const existing = registry.getRecord(validation.value);
        if (existing) {
            registry.recordUnmount(validation.value);
            store.recordFiberRootEvent(
                createRootEvent({
                    lifecycle: 'unmounted',
                    rendererId,
                    rootId: existing.id,
                    source
                })
            );
            const state = store.getState();
            const removedSelection =
                state.selectedRootId === existing.id ||
                state.components.some(
                    (component) =>
                        component.id === state.selectedComponentId &&
                        component.rootId === existing.id
                );
            store.update({
                roots: state.roots.filter((root) => root.id !== existing.id),
                ...(removedSelection
                    ? { selectedRootId: null, selectedComponentId: null }
                    : {})
            });
            scheduleRefresh();
        }
        return;
    }
    const record = registry.recordCommit(validation.value);
    scheduleRefresh();
    store.recordFiberRootEvent(
        createRootEvent({
            didError,
            lifecycle,
            priorityLevel,
            rendererId,
            rootId: record.id,
            source
        })
    );
}

function refreshRootsAndComponents({
    registry,
    store,
    walker
}: {
    registry: ReturnType<typeof createFiberRootRegistry>;
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
}): void {
    const roots = registry.records.map((record) => ({
        ...store.getState().roots.find((root) => root.id === record.id),
        id: record.id,
        label: record.id,
        targetId: USER_APP_TARGET_ID,
        updatedAt: Date.now()
    }));
    const components = registry.records.flatMap((record) =>
        metadataOnly(
            walker.getComponentTree(record.root, {
                rootId: record.id,
                identities: record.identities
            })
        )
    );

    store.setRoots(roots);
    const flatComponents = flattenComponents(components);
    store.setComponents(flatComponents);
    const activeIds = new Set(flatComponents.map((component) => component.id));
    const selected = store.getState().selectedComponentId;
    if (selected && !activeIds.has(selected))
        store.update({ selectedComponentId: null });
    const highlighted = store.getState().highlightedComponentId;
    if (highlighted && !activeIds.has(highlighted)) {
        unhighlightElement();
        store.update({ highlightedComponentId: null });
    }

    for (const record of registry.records) record.refresh();
}

function metadataOnly(nodes: ComponentNode[]): ComponentNode[] {
    return nodes.map((node) => ({
        ...node,
        children: metadataOnly(node.children ?? []),
        contexts: node.contexts?.map(
            ({ value: _value, ...context }) => context
        ),
        diagnostics: node.diagnostics?.map(
            ({ capturedError: _error, ...diagnostic }) => diagnostic
        )
    }));
}

function createComponentStateResponse(
    componentId: string,
    rootId: string,
    fiber: ReactFiber
): ComponentStateResponse {
    const rect = getBoundingRect(fiber);
    return {
        ...(rect
            ? {
                  domRect: {
                      x: rect.x,
                      y: rect.y,
                      width: rect.width,
                      height: rect.height
                  }
              }
            : {}),
        componentId,
        contexts: inspectReactFiberContexts(fiber).map(
            ({ value: _value, ...context }) => context
        ),
        diagnostics: inspectReactFiberDiagnostics(fiber).map(
            ({ capturedError: _error, ...diagnostic }) => diagnostic
        ),
        rootId,
        editing: { props: false, hooks: false, state: false, context: false },
        sections: getComponentStateSections(fiber)
    };
}

function flattenComponents(nodes: ComponentNode[]): ComponentNode[] {
    return nodes.flatMap((node) => [
        node,
        ...flattenComponents(node.children ?? [])
    ]);
}

function createRootEvent({
    didError,
    lifecycle,
    priorityLevel,
    rendererId,
    rootId,
    source
}: {
    didError?: boolean;
    lifecycle: FiberRootEventRecord['lifecycle'];
    priorityLevel?: unknown;
    rendererId: number;
    rootId: string;
    source: FiberRootEventRecord['source'];
}): FiberRootEventRecord {
    const timestamp = Date.now();

    return {
        didError,
        id: `root-event:${rendererId}:${rootId}:${source}:${timestamp}`,
        lifecycle,
        priorityLevel,
        rendererId,
        rootId,
        source,
        targetId: USER_APP_TARGET_ID,
        timestamp
    };
}

function getNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

function getString(
    ...values: Array<string | undefined | unknown>
): string | undefined {
    return values.find((value): value is string => typeof value === 'string');
}

export {};
