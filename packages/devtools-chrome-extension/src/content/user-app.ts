import {
    createDevToolsCoreServerFunctions,
    createDevToolsCoreStateStore,
    createInitialDevToolsCoreState,
    createDevToolsUpdatePublisher,
    createFiberRootRegistry,
    createFiberWalker,
    getHooksStateSection,
    getPropsStateSection,
    highlightElement,
    inspectReactFiberContexts,
    inspectReactFiberDiagnostics,
    unhighlightElement,
    validateReactFiberRoot,
    validateReactRenderer,
    type ComponentNode,
    type ComponentStateResponse,
    type DevToolsCoreServerFunctions,
    type DevToolsCoreStateStore,
    type FiberRootEventRecord,
    type ReactFiber,
    type RendererRecord
} from '@devtools/core';
import {
    createDevToolsHook,
    createRpcServer,
    createExtensionServerChannel,
    isCompatibleReactHook,
    REACT_DEVTOOLS_GLOBAL_HOOK_KEY,
    type ReactDevToolsGlobalHook,
    type ReactDevToolsHookEventMap
} from '@devtools/kit';

const USER_APP_READY_EVENT = '__react_devtools_user_app_ready__';
const USER_APP_TARGET_ID = 'top';
const USER_APP_SERVER_ID = 'react-devtools-extension-user-app';

interface UserAppRpcServerBootstrapResult {
    didOpenRpcServer: boolean;
    hookMode: 'disabled' | 'installed' | 'missing' | 'wrapped';
    rendererCount: number;
    rootCount: number;
    dispose?: () => void;
}

interface UserAppWindow extends Window {
    [REACT_DEVTOOLS_GLOBAL_HOOK_KEY]?: unknown;
}

const bootstrapResult = bootstrapUserAppRpcServer(window);

window.dispatchEvent(
    new CustomEvent(USER_APP_READY_EVENT, {
        detail: {
            ...bootstrapResult,
            source: 'react-devtools-extension'
        }
    })
);

export function bootstrapUserAppRpcServer(
    target: UserAppWindow
): UserAppRpcServerBootstrapResult {
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
        flushRefresh
    );

    const server = createRpcServer<
        import('@devtools/core').DevToolsCoreClientFunctions,
        DevToolsCoreServerFunctions
    >(serverFunctions, {
        channel: createExtensionServerChannel({ window: target }),
        options: { timeout: 5000 },
        onDisconnect: () => updates.suspend()
    });
    const dispose = () => {
        updates.dispose();
        server.dispose();
        target.removeEventListener('pagehide', dispose);
    };
    target.addEventListener('pagehide', dispose);

    return {
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
    flushRefresh: () => void
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
                    components: false,
                    componentState: false
                },
                state: createSessionState(store)
            };
        },
        getComponents(request) {
            flushRefresh();
            return coreFunctions.getComponents(request);
        },
        getComponentState(request) {
            flushRefresh();
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
            const fiber = findFiberByComponentId(registry, request.componentId);

            if (!fiber) {
                unhighlightElement();

                return coreFunctions.highlightComponent(request);
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
    store.setRenderers(createRendererRecords(hook));

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
        store.setRenderers(createRendererRecords(hook));
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
    hook: ReactDevToolsGlobalHook
): RendererRecord[] {
    return Array.from(hook.renderers.entries()).map(([id, renderer]) => {
        const validation = validateReactRenderer(renderer, {
            rendererId: id,
            targetId: USER_APP_TARGET_ID,
            timestamp: Date.now()
        });
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
        walker.getComponentTree(record.root, { rootId: record.id })
    );

    store.setRoots(roots);
    store.setComponents(flattenComponents(components));

    for (const record of registry.records) record.refresh();
}

function createComponentStateResponse(
    componentId: string,
    rootId: string,
    fiber: ReactFiber
): ComponentStateResponse {
    return {
        componentId,
        contexts: inspectReactFiberContexts(fiber),
        diagnostics: inspectReactFiberDiagnostics(fiber),
        rootId,
        sections: [getPropsStateSection(fiber), getHooksStateSection(fiber)]
    };
}

function flattenComponents(nodes: ComponentNode[]): ComponentNode[] {
    return nodes.flatMap((node) => [
        node,
        ...flattenComponents(node.children ?? [])
    ]);
}

function findFiberByComponentId(
    registry: ReturnType<typeof createFiberRootRegistry>,
    componentId: string
): ReactFiber | null {
    for (const record of registry.records) {
        const fiber = record.instanceMap.get(componentId);

        if (fiber) {
            return fiber;
        }
    }

    return null;
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
