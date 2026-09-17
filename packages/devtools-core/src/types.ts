import type {
    CustomCommand,
    CustomInspectorNode,
    CustomInspectorOptions,
    CustomTab,
    InspectorState,
    TimelineEventOptions,
    TimelineLayerOptions
} from '@devtools/kit';

export enum DevToolsCoreRpcEvent {
    HANDSHAKE = 'core:handshake',
    STATE_UPDATED = 'core:state-updated',
    ROOTS_UPDATED = 'roots:updated',
    RENDERERS_UPDATED = 'renderers:updated',
    ROOT_EVENT_RECORDED = 'roots:event-recorded',
    DETECTION_DIAGNOSTIC_REPORTED = 'detection:diagnostic-reported',
    PERFORMANCE_MODE_TOGGLED = 'performance:mode-toggled',
    PERFORMANCE_SETTINGS_UPDATED = 'performance:settings-updated',
    PERFORMANCE_REFRESH_THROTTLED = 'performance:refresh-throttled',
    INSPECT_MODE_UPDATED = 'inspect:mode-updated',
    INSPECT_TARGET_HOVERED = 'inspect:target-hovered',
    INSPECT_TARGET_SELECTED = 'inspect:target-selected',
    COMPONENTS_UPDATED = 'components:updated',
    COMPONENT_STATE_REQUESTED = 'component-state:requested',
    HIGHLIGHT_REQUESTED = 'highlight:requested',
    TIMELINE_LAYER_ADDED = 'timeline:layer-added',
    TIMELINE_EVENT_ADDED = 'timeline:event-added',
    CUSTOM_INSPECTOR_REGISTERED = 'custom-inspector:registered',
    CUSTOM_INSPECTOR_TREE_REQUESTED = 'custom-inspector:tree-requested',
    CUSTOM_INSPECTOR_STATE_REQUESTED = 'custom-inspector:state-requested',
    CUSTOM_TAB_REGISTERED = 'custom-tab:registered',
    CUSTOM_COMMAND_REGISTERED = 'custom-command:registered',
    CUSTOM_COMMAND_REMOVED = 'custom-command:removed',
    ASSETS_REQUESTED = 'assets:requested',
    GRAPH_REQUESTED = 'graph:requested',
    ROUTES_REQUESTED = 'routes:requested',
    SETTINGS_UPDATED = 'settings:updated'
}

export type TransportStatus = 'connected' | 'connecting' | 'disconnected';
export type DetectionTargetKind = 'iframe' | 'window' | 'worker';
export type FiberRootLifecycle =
    'added' | 'committed' | 'disconnected' | 'unmounted' | 'updated';
export type DetectionDiagnosticSeverity = 'error' | 'info' | 'warning';

export interface DetectionTargetContext {
    framePath?: string[];
    id: string;
    kind: DetectionTargetKind;
    origin?: string;
    parentId?: string;
}

export interface RendererRecord {
    bundleType?: number;
    capabilities?: {
        hasFiberRoots?: boolean;
        hasRendererInterface?: boolean;
        supportsProfiling?: boolean;
    };
    detectedAt?: number;
    id: number | string;
    packageName?: string;
    name?: string;
    reconcilerVersion?: string;
    targetId?: string;
    version?: string;
}

export interface RootRecord {
    commitCount?: number;
    disconnectedAt?: number;
    iframeId?: string;
    id: string;
    label?: string;
    lifecycle?: FiberRootLifecycle;
    mountedAt?: number;
    parentRootId?: string;
    portalContainerId?: string;
    rendererId?: number | string;
    targetId?: string;
    updatedAt?: number;
}

export interface FiberRootEventRecord {
    didError?: boolean;
    id: string;
    lifecycle: FiberRootLifecycle;
    priorityLevel?: unknown;
    rendererId: number | string;
    rootId: string;
    source:
        | 'getFiberRoots'
        | 'onCommitFiberRoot'
        | 'onCommitFiberUnmount'
        | 'onPostCommitFiberRoot';
    targetId: string;
    timestamp: number;
}

export interface DetectionDiagnosticRecord {
    code:
        | 'auto-paused'
        | 'existing-hook-incompatible'
        | 'fiber-field-missing'
        | 'fiber-host-node-unavailable'
        | 'fiber-root-unavailable'
        | 'fiber-tag-unknown'
        | 'refresh-throttled'
        | 'react-internals-unavailable'
        | 'renderer-version-unsupported'
        | 'renderer-unsupported'
        | 'tree-depth-truncated'
        | 'tree-node-limit-truncated'
        | 'unknown-detector-error';
    details?: Record<string, unknown>;
    id: string;
    message: string;
    rendererId?: number | string;
    rootId?: string;
    severity: DetectionDiagnosticSeverity;
    targetId?: string;
    timestamp: number;
}

export interface PerformanceModeSettings {
    autoPauseCommitThreshold: number;
    autoPauseWindowMs: number;
    commitDebounceMs: number;
    enabled: boolean;
    maxNodeCount: number;
    maxTreeDepth: number;
    pauseExpensiveTreeRefreshes: boolean;
    pausePluginSetup: boolean;
}

export interface PerformanceRuntimeFlags {
    commitCountInWindow: number;
    lastCommitAt: null | number;
    lastTreeRefreshAt: null | number;
    pluginSetupPaused: boolean;
    treeRefreshPaused: boolean;
    windowStartedAt: null | number;
}

export interface PerformanceModeState {
    flags: PerformanceRuntimeFlags;
    settings: PerformanceModeSettings;
}

export interface TreeRefreshRequest {
    reason: 'commit' | 'manual' | 'selection' | string;
    requestedAt: number;
}

export interface TreeRefreshDecision {
    allowed: boolean;
    diagnostic?: DetectionDiagnosticRecord;
    nextAllowedAt?: number;
}

export interface ComponentSourceLocation {
    columnNumber: number;
    fileName: string;
    lineNumber: number;
}

export type ComponentContextKind = 'consumer' | 'dependency' | 'provider';

export interface ComponentContextRecord {
    displayName: string;
    id?: string;
    kind: ComponentContextKind;
    observedBits?: number;
    value?: unknown;
}

export interface InspectTargetRecord {
    componentId?: null | string;
    displayName?: string;
    domRect?: {
        height: number;
        width: number;
        x: number;
        y: number;
    };
    rootId?: null | string;
    source?: ComponentSourceLocation;
    targetId?: string;
}

export interface InspectModeState {
    enabled: boolean;
    hoveredTarget: InspectTargetRecord | null;
    lastSelectedTarget: InspectTargetRecord | null;
}

export interface ComponentNode {
    children?: ComponentNode[];
    contexts?: ComponentContextRecord[];
    displayName: string;
    id: string;
    key?: null | string;
    rootId: string;
    source?: ComponentSourceLocation;
    type?: string;
}

export interface ComponentStateSection {
    fields: Array<{
        editable?: boolean;
        name: string;
        value: unknown;
    }>;
    name: 'context' | 'hooks' | 'props' | 'state' | string;
}

export interface ComponentStateResponse {
    componentId: string;
    contexts?: ComponentContextRecord[];
    rootId: string;
    sections: ComponentStateSection[];
    source?: ComponentSourceLocation;
}

export interface HighlightRequest {
    componentId: string;
    rootId: string;
}

export interface TimelineLayerRecord extends TimelineLayerOptions {}

export interface TimelineEventRecord<
    Data = unknown
> extends TimelineEventOptions<Data> {
    id?: string;
}

export interface CustomInspectorRecord extends CustomInspectorOptions {
    pluginId?: string;
    state?: InspectorState;
    tree?: Array<CustomInspectorNode>;
}

export interface AssetInfo {
    id: string;
    importer?: string;
    path: string;
    publicPath?: string;
    type: 'font' | 'image' | 'media' | 'other' | 'style';
}

export interface ModuleGraphNode {
    id: string;
    importers?: string[];
    imports?: string[];
    url?: string;
}

export interface RouteRecord {
    component?: string;
    id: string;
    path: string;
}

export type SettingsRecord = Record<string, unknown>;

export interface DevToolsCoreState {
    assets: AssetInfo[];
    commands: CustomCommand[];
    componentState: Record<string, ComponentStateResponse>;
    components: ComponentNode[];
    customInspectors: CustomInspectorRecord[];
    customTabs: CustomTab[];
    diagnostics: DetectionDiagnosticRecord[];
    graph: ModuleGraphNode[];
    highlightedComponentId: null | string;
    inspectMode: InspectModeState;
    performance: PerformanceModeState;
    renderers: RendererRecord[];
    rootEvents: FiberRootEventRecord[];
    roots: RootRecord[];
    routes: RouteRecord[];
    selectedComponentId: null | string;
    selectedRootId: null | string;
    settings: SettingsRecord;
    timelineEvents: TimelineEventRecord[];
    timelineLayers: TimelineLayerRecord[];
    transportStatus: TransportStatus;
}

export type DevToolsCoreStatePatch = Partial<DevToolsCoreState>;
export type PerformanceModeSettingsPatch = Partial<PerformanceModeSettings>;

export interface DevToolsCoreHandshakeRequest {
    clientId: string;
    supportedEvents?: DevToolsCoreRpcEvent[];
}

export interface DevToolsCoreHandshakeResponse {
    serverId: string;
    state: DevToolsCoreState;
}

export interface RootsRequest {
    rendererId?: number | string;
}

export interface RootsResponse {
    roots: RootRecord[];
}

export interface RenderersResponse {
    renderers: RendererRecord[];
}

export interface RootEventResponse {
    rootEvent: FiberRootEventRecord;
    roots: RootRecord[];
}

export interface DetectionDiagnosticsRequest {
    severity?: DetectionDiagnosticSeverity;
    targetId?: string;
}

export interface DetectionDiagnosticsResponse {
    diagnostics: DetectionDiagnosticRecord[];
}

export interface PerformanceStateResponse {
    performance: PerformanceModeState;
}

export interface InspectModeResponse {
    inspectMode: InspectModeState;
}

export interface ComponentsRequest {
    rootId: string;
}

export interface ComponentsResponse {
    components: ComponentNode[];
}

export interface ComponentStateRequest {
    componentId: string;
    rootId: string;
}

export interface CustomInspectorTreeRequest {
    filter?: string;
    inspectorId: string;
}

export interface CustomInspectorTreeResponse {
    inspectorId: string;
    rootNodes: Array<CustomInspectorNode>;
}

export interface CustomInspectorStateRequest {
    inspectorId: string;
    nodeId: string;
}

export interface CustomInspectorStateResponse {
    inspectorId: string;
    nodeId: string;
    state: InspectorState;
}

export interface AssetsRequest {
    type?: AssetInfo['type'];
}

export interface AssetsResponse {
    assets: AssetInfo[];
}

export interface GraphRequest {
    rootId?: string;
}

export interface GraphResponse {
    graph: ModuleGraphNode[];
}

export interface RoutesRequest {
    rootId?: string;
}

export interface RoutesResponse {
    routes: RouteRecord[];
}
