import {
    createDevToolsCoreServerFunctions,
    createDevToolsCoreStateStore,
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
    const serverFunctions = createUserAppServerFunctions(store, registry);

    createRpcServer(serverFunctions, { preset: 'extension' });
    syncHookSnapshot({
        hook: hookInstallation.hook,
        registry,
        store,
        walker
    });
    subscribeToHookEvents({
        hook: hookInstallation.hook,
        registry,
        store,
        walker
    });

    return {
        didOpenRpcServer: true,
        hookMode: hookInstallation.mode,
        rendererCount: store.getState().renderers.length,
        rootCount: store.getState().roots.length
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
    registry: ReturnType<typeof createFiberRootRegistry>
): DevToolsCoreServerFunctions {
    const coreFunctions = createDevToolsCoreServerFunctions(
        store,
        USER_APP_SERVER_ID
    );

    return {
        ...coreFunctions,
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

function syncHookSnapshot({
    hook,
    registry,
    store,
    walker
}: {
    hook: ReactDevToolsGlobalHook;
    registry: ReturnType<typeof createFiberRootRegistry>;
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
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
                walker
            });
        }
    }
}

function subscribeToHookEvents({
    hook,
    registry,
    store,
    walker
}: {
    hook: ReactDevToolsGlobalHook;
    registry: ReturnType<typeof createFiberRootRegistry>;
    store: DevToolsCoreStateStore;
    walker: ReturnType<typeof createFiberWalker>;
}): void {
    hook.on('renderer', () => {
        store.setRenderers(createRendererRecords(hook));
    });
    hook.on('commit-fiber-root', (event) => {
        recordCommittedRoot({
            didError: event.didError,
            lifecycle: 'committed',
            priorityLevel: event.priorityLevel,
            rendererId: event.rendererID,
            registry,
            root: event.root,
            source: 'onCommitFiberRoot',
            store,
            walker
        });
    });
    hook.on('post-commit-fiber-root', (event) => {
        recordCommittedRoot({
            lifecycle: 'updated',
            rendererId: event.rendererID,
            registry,
            root: event.root,
            source: 'onPostCommitFiberRoot',
            store,
            walker
        });
    });
    hook.on('commit-fiber-unmount', (event) => {
        if (!registry.recordUnmount(event.fiber as unknown as ReactFiber)) {
            return;
        }

        refreshRootsAndComponents({ registry, store, walker });
        store.recordFiberRootEvent(
            createRootEvent({
                lifecycle: 'unmounted',
                rendererId: event.rendererID,
                rootId: 'unknown',
                source: 'onCommitFiberUnmount'
            })
        );
    });
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
    walker
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

    const record = registry.recordCommit(validation.value);

    refreshRootsAndComponents({ registry, store, walker });
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

    for (const record of registry.records) {
        record.refresh();

        for (const [componentId, fiber] of record.instanceMap) {
            store.setComponentState(
                createComponentStateResponse(componentId, record.id, fiber)
            );
        }
    }
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
