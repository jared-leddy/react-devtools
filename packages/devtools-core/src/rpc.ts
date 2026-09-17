import {
    createRpcClient,
    createRpcServer,
    type CreateRpcClientOptions,
    type CreateRpcServerOptions,
    type Presets,
    type RpcChannel
} from '@devtools/kit';

import type { DevToolsCoreStateStore } from './state.js';
import { createDevToolsCoreStateStore } from './state.js';
import type {
    AssetsRequest,
    AssetsResponse,
    ComponentStateRequest,
    ComponentStateResponse,
    ComponentsRequest,
    ComponentsResponse,
    CustomInspectorRecord,
    CustomInspectorStateRequest,
    CustomInspectorStateResponse,
    CustomInspectorTreeRequest,
    CustomInspectorTreeResponse,
    DetectionDiagnosticRecord,
    DetectionDiagnosticsRequest,
    DetectionDiagnosticsResponse,
    DevToolsCoreHandshakeRequest,
    DevToolsCoreHandshakeResponse,
    DevToolsCoreState,
    DevToolsCoreStatePatch,
    FiberRootEventRecord,
    GraphRequest,
    GraphResponse,
    HighlightRequest,
    InspectModeResponse,
    InspectTargetRecord,
    PerformanceModeSettingsPatch,
    PerformanceStateResponse,
    RendererRecord,
    RenderersResponse,
    RootRecord,
    RootEventResponse,
    RootsRequest,
    RootsResponse,
    RoutesRequest,
    RoutesResponse,
    TreeRefreshDecision,
    TreeRefreshRequest,
    TransportStatus
} from './types.js';
import type {
    CustomCommand,
    CustomInspectorNode,
    CustomTab,
    InspectorState,
    TimelineEventOptions,
    TimelineLayerOptions
} from '@devtools/kit';

export interface DevToolsCoreClientFunctions {
    notifyStateUpdated: (patch: DevToolsCoreStatePatch) => void;
    setTransportStatus: (status: TransportStatus) => void;
}

export interface DevToolsCoreServerFunctions {
    addTimelineEvent: (event: TimelineEventOptions) => DevToolsCoreState;
    addTimelineLayer: (layer: TimelineLayerOptions) => DevToolsCoreState;
    getAssets: (request?: AssetsRequest) => AssetsResponse;
    getComponentState: (
        request: ComponentStateRequest
    ) => ComponentStateResponse | undefined;
    getComponents: (request: ComponentsRequest) => ComponentsResponse;
    getDetectionDiagnostics: (
        request?: DetectionDiagnosticsRequest
    ) => DetectionDiagnosticsResponse;
    getGraph: (request?: GraphRequest) => GraphResponse;
    getInspectMode: () => InspectModeResponse;
    getPerformanceState: () => PerformanceStateResponse;
    getRenderers: () => RenderersResponse;
    getRoutes: (request?: RoutesRequest) => RoutesResponse;
    getRoots: (request?: RootsRequest) => RootsResponse;
    getState: () => DevToolsCoreState;
    handshake: (
        request: DevToolsCoreHandshakeRequest
    ) => DevToolsCoreHandshakeResponse;
    highlightComponent: (request: HighlightRequest) => DevToolsCoreState;
    recordFiberRootEvent: (
        rootEvent: FiberRootEventRecord
    ) => RootEventResponse;
    registerCustomCommand: (command: CustomCommand) => DevToolsCoreState;
    registerCustomInspector: (
        inspector: CustomInspectorRecord
    ) => DevToolsCoreState;
    registerCustomTab: (tab: CustomTab) => DevToolsCoreState;
    reportDetectionDiagnostic: (
        diagnostic: DetectionDiagnosticRecord
    ) => DevToolsCoreState;
    selectInspectTarget: (target: InspectTargetRecord) => DevToolsCoreState;
    requestTreeRefresh: (request: TreeRefreshRequest) => TreeRefreshDecision;
    removeCustomCommand: (commandId: string) => DevToolsCoreState;
    selectComponent: (componentId: null | string) => DevToolsCoreState;
    selectRoot: (rootId: null | string) => DevToolsCoreState;
    setInspectMode: (enabled: boolean) => DevToolsCoreState;
    setHighPerformanceMode: (enabled: boolean) => DevToolsCoreState;
    toggleInspectMode: () => DevToolsCoreState;
    sendInspectorState: (
        request: CustomInspectorStateRequest
    ) => CustomInspectorStateResponse;
    sendInspectorTree: (
        request: CustomInspectorTreeRequest
    ) => CustomInspectorTreeResponse;
    updateRenderers: (renderers: RendererRecord[]) => DevToolsCoreState;
    updatePerformanceSettings: (
        settings: PerformanceModeSettingsPatch
    ) => DevToolsCoreState;
    updateInspectHover: (
        target: InspectTargetRecord | null
    ) => DevToolsCoreState;
    updateRoots: (roots: RootRecord[]) => DevToolsCoreState;
    updateState: (patch: DevToolsCoreStatePatch) => DevToolsCoreState;
}

export interface CreateDevToolsCoreClientOptions extends Omit<
    CreateRpcClientOptions<
        DevToolsCoreServerFunctions,
        DevToolsCoreClientFunctions
    >,
    'preset'
> {
    preset?: Presets;
}

export interface CreateDevToolsCoreServerOptions extends Omit<
    CreateRpcServerOptions<
        DevToolsCoreClientFunctions,
        DevToolsCoreServerFunctions
    >,
    'preset'
> {
    preset?: Presets;
    serverId?: string;
    store?: DevToolsCoreStateStore;
}

export function createDevToolsCoreClient(
    options: CreateDevToolsCoreClientOptions = {}
) {
    const clientFunctions: DevToolsCoreClientFunctions = {
        notifyStateUpdated(_patch) {},
        setTransportStatus(_status) {}
    };

    return createRpcClient<
        DevToolsCoreServerFunctions,
        DevToolsCoreClientFunctions
    >(clientFunctions, options);
}

export function createDevToolsCoreServer(
    options: CreateDevToolsCoreServerOptions = {}
) {
    const store = options.store ?? createDevToolsCoreStateStore();
    const serverFunctions = createDevToolsCoreServerFunctions(
        store,
        options.serverId
    );

    return createRpcServer<
        DevToolsCoreClientFunctions,
        DevToolsCoreServerFunctions
    >(serverFunctions, options);
}

export function createDevToolsCoreServerFunctions(
    store: DevToolsCoreStateStore,
    serverId = 'react-devtools-core'
): DevToolsCoreServerFunctions {
    return {
        addTimelineEvent(event) {
            return store.addTimelineEvent(event);
        },
        addTimelineLayer(layer) {
            return store.addTimelineLayer(layer);
        },
        getAssets(request) {
            const assets = store
                .getState()
                .assets.filter(
                    (asset) => !request?.type || asset.type === request.type
                );

            return { assets };
        },
        getComponentState(request) {
            return store.getState().componentState[request.componentId];
        },
        getComponents(request) {
            return {
                components: store
                    .getState()
                    .components.filter(
                        (component) => component.rootId === request.rootId
                    )
            };
        },
        getGraph(_request) {
            return { graph: store.getState().graph };
        },
        getInspectMode() {
            return { inspectMode: store.getState().inspectMode };
        },
        getDetectionDiagnostics(request) {
            const diagnostics = store
                .getState()
                .diagnostics.filter(
                    (diagnostic) =>
                        (!request?.severity ||
                            diagnostic.severity === request.severity) &&
                        (!request?.targetId ||
                            diagnostic.targetId === request.targetId)
                );

            return { diagnostics };
        },
        getPerformanceState() {
            return { performance: store.getState().performance };
        },
        getRenderers() {
            return { renderers: store.getState().renderers };
        },
        getRoutes(_request) {
            return { routes: store.getState().routes };
        },
        getRoots(request) {
            const roots = store
                .getState()
                .roots.filter(
                    (root) =>
                        !request?.rendererId ||
                        root.rendererId === request.rendererId
                );

            return { roots };
        },
        getState() {
            return store.getState();
        },
        handshake(_request) {
            store.setTransportStatus('connected');

            return {
                serverId,
                state: store.getState()
            };
        },
        highlightComponent(request) {
            return store.update({
                highlightedComponentId: request.componentId
            });
        },
        recordFiberRootEvent(rootEvent) {
            const state = store.recordFiberRootEvent(rootEvent);

            return {
                rootEvent,
                roots: state.roots
            };
        },
        registerCustomCommand(command) {
            return store.registerCustomCommand(command);
        },
        registerCustomInspector(inspector) {
            return store.registerCustomInspector(inspector);
        },
        registerCustomTab(tab) {
            return store.registerCustomTab(tab);
        },
        reportDetectionDiagnostic(diagnostic) {
            return store.reportDiagnostic(diagnostic);
        },
        selectInspectTarget(target) {
            return store.recordInspectSelection(target);
        },
        requestTreeRefresh(request) {
            return store.recordTreeRefreshRequest(request);
        },
        removeCustomCommand(commandId) {
            return store.removeCustomCommand(commandId);
        },
        setHighPerformanceMode(enabled) {
            return store.setHighPerformanceMode(enabled);
        },
        setInspectMode(enabled) {
            return store.setInspectMode(enabled);
        },
        selectComponent(componentId) {
            return store.selectComponent(componentId);
        },
        selectRoot(rootId) {
            return store.selectRoot(rootId);
        },
        toggleInspectMode() {
            return store.setInspectMode(!store.getState().inspectMode.enabled);
        },
        sendInspectorState(request) {
            const inspector = getInspector(store, request.inspectorId);

            return {
                inspectorId: request.inspectorId,
                nodeId: request.nodeId,
                state: inspector.state ?? {}
            };
        },
        sendInspectorTree(request) {
            const inspector = getInspector(store, request.inspectorId);

            return {
                inspectorId: request.inspectorId,
                rootNodes: filterInspectorTree(
                    inspector.tree ?? [],
                    request.filter
                )
            };
        },
        updateRoots(roots) {
            return store.setRoots(roots);
        },
        updatePerformanceSettings(settings) {
            return store.setPerformanceSettings(settings);
        },
        updateInspectHover(target) {
            return store.recordInspectHover(target);
        },
        updateRenderers(renderers) {
            return store.setRenderers(renderers);
        },
        updateState(patch) {
            return store.update(patch);
        }
    };
}

export function createPresetCoreClient(preset: Presets = 'iframe') {
    return createDevToolsCoreClient({ preset });
}

export function createPresetCoreServer(
    preset: Presets = 'iframe',
    store = createDevToolsCoreStateStore()
) {
    return createDevToolsCoreServer({ preset, store });
}

export type { RpcChannel };

function getInspector(
    store: DevToolsCoreStateStore,
    inspectorId: string
): {
    state?: InspectorState;
    tree?: Array<CustomInspectorNode>;
} {
    const inspector = store
        .getState()
        .customInspectors.find((item) => item.id === inspectorId);

    if (!inspector) {
        return {};
    }

    return inspector;
}

function filterInspectorTree(
    nodes: Array<CustomInspectorNode>,
    filter: string | undefined
): Array<CustomInspectorNode> {
    if (!filter) {
        return nodes;
    }

    const normalizedFilter = filter.toLocaleLowerCase();

    return nodes.filter((node) =>
        node.label.toLocaleLowerCase().includes(normalizedFilter)
    );
}
