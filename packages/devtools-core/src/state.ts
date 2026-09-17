import type {
    AssetInfo,
    ComponentNode,
    ComponentStateResponse,
    CustomInspectorRecord,
    DetectionDiagnosticRecord,
    DevToolsCoreState,
    DevToolsCoreStatePatch,
    FiberRootEventRecord,
    ModuleGraphNode,
    RendererRecord,
    RootRecord,
    RouteRecord,
    SettingsRecord,
    TimelineEventRecord,
    TimelineLayerRecord,
    TransportStatus
} from './types.js';
import type { CustomCommand, CustomTab } from '@devtools/kit';

export type DevToolsCoreStateListener = (
    state: DevToolsCoreState,
    patch: DevToolsCoreStatePatch
) => void;

export interface DevToolsCoreStateStore {
    addTimelineEvent(event: TimelineEventRecord): DevToolsCoreState;
    addTimelineLayer(layer: TimelineLayerRecord): DevToolsCoreState;
    getState(): DevToolsCoreState;
    recordFiberRootEvent(rootEvent: FiberRootEventRecord): DevToolsCoreState;
    registerCustomCommand(command: CustomCommand): DevToolsCoreState;
    registerCustomInspector(
        inspector: CustomInspectorRecord
    ): DevToolsCoreState;
    registerCustomTab(tab: CustomTab): DevToolsCoreState;
    reportDiagnostic(diagnostic: DetectionDiagnosticRecord): DevToolsCoreState;
    removeCustomCommand(commandId: string): DevToolsCoreState;
    replaceState(state: DevToolsCoreState): DevToolsCoreState;
    selectComponent(componentId: null | string): DevToolsCoreState;
    selectRoot(rootId: null | string): DevToolsCoreState;
    setAssets(assets: AssetInfo[]): DevToolsCoreState;
    setComponentState(state: ComponentStateResponse): DevToolsCoreState;
    setComponents(components: ComponentNode[]): DevToolsCoreState;
    setGraph(graph: ModuleGraphNode[]): DevToolsCoreState;
    setRenderers(renderers: RendererRecord[]): DevToolsCoreState;
    setRoots(roots: RootRecord[]): DevToolsCoreState;
    setRoutes(routes: RouteRecord[]): DevToolsCoreState;
    setSettings(settings: SettingsRecord): DevToolsCoreState;
    setTransportStatus(status: TransportStatus): DevToolsCoreState;
    subscribe(listener: DevToolsCoreStateListener): () => void;
    update(patch: DevToolsCoreStatePatch): DevToolsCoreState;
}

export function createInitialDevToolsCoreState(): DevToolsCoreState {
    return {
        assets: [],
        commands: [],
        componentState: {},
        components: [],
        customInspectors: [],
        customTabs: [],
        diagnostics: [],
        graph: [],
        highlightedComponentId: null,
        renderers: [],
        rootEvents: [],
        roots: [],
        routes: [],
        selectedComponentId: null,
        selectedRootId: null,
        settings: {},
        timelineEvents: [],
        timelineLayers: [],
        transportStatus: 'disconnected'
    };
}

export function createDevToolsCoreStateStore(
    initialState: DevToolsCoreState = createInitialDevToolsCoreState()
): DevToolsCoreStateStore {
    let state = cloneState(initialState);
    const listeners = new Set<DevToolsCoreStateListener>();

    const notify = (patch: DevToolsCoreStatePatch): DevToolsCoreState => {
        for (const listener of listeners) {
            listener(state, patch);
        }

        return state;
    };
    const update = (patch: DevToolsCoreStatePatch): DevToolsCoreState => {
        state = { ...state, ...patch };

        return notify(patch);
    };

    return {
        addTimelineEvent(event) {
            return update({ timelineEvents: [...state.timelineEvents, event] });
        },
        addTimelineLayer(layer) {
            return update({
                timelineLayers: upsertById(state.timelineLayers, layer)
            });
        },
        getState() {
            return state;
        },
        recordFiberRootEvent(rootEvent) {
            const currentRoot = state.roots.find(
                (root) => root.id === rootEvent.rootId
            );
            return update({
                rootEvents: [...state.rootEvents, rootEvent],
                roots: upsertById(state.roots, {
                    ...currentRoot,
                    commitCount:
                        (currentRoot?.commitCount ?? 0) +
                        (rootEvent.lifecycle === 'committed' ? 1 : 0),
                    disconnectedAt:
                        rootEvent.lifecycle === 'disconnected'
                            ? rootEvent.timestamp
                            : currentRoot?.disconnectedAt,
                    id: rootEvent.rootId,
                    lifecycle: rootEvent.lifecycle,
                    mountedAt:
                        currentRoot?.mountedAt ??
                        (rootEvent.lifecycle === 'added'
                            ? rootEvent.timestamp
                            : undefined),
                    rendererId: rootEvent.rendererId,
                    targetId: rootEvent.targetId,
                    updatedAt: rootEvent.timestamp
                })
            });
        },
        registerCustomCommand(command) {
            return update({ commands: upsertById(state.commands, command) });
        },
        registerCustomInspector(inspector) {
            return update({
                customInspectors: upsertById(state.customInspectors, inspector)
            });
        },
        registerCustomTab(tab) {
            return update({
                customTabs: upsertByKey(state.customTabs, tab, 'name')
            });
        },
        reportDiagnostic(diagnostic) {
            return update({
                diagnostics: upsertById(state.diagnostics, diagnostic)
            });
        },
        removeCustomCommand(commandId) {
            return update({
                commands: state.commands.filter(
                    (command) => command.id !== commandId
                )
            });
        },
        replaceState(nextState) {
            state = cloneState(nextState);

            return notify(state);
        },
        selectComponent(componentId) {
            return update({ selectedComponentId: componentId });
        },
        selectRoot(rootId) {
            return update({ selectedRootId: rootId });
        },
        setAssets(assets) {
            return update({ assets });
        },
        setComponentState(componentState) {
            return update({
                componentState: {
                    ...state.componentState,
                    [componentState.componentId]: componentState
                }
            });
        },
        setComponents(components) {
            return update({ components });
        },
        setGraph(graph) {
            return update({ graph });
        },
        setRenderers(renderers) {
            return update({ renderers });
        },
        setRoots(roots) {
            return update({ roots });
        },
        setRoutes(routes) {
            return update({ routes });
        },
        setSettings(settings) {
            return update({ settings });
        },
        setTransportStatus(status) {
            return update({ transportStatus: status });
        },
        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        update
    };
}

function cloneState(state: DevToolsCoreState): DevToolsCoreState {
    return {
        ...state,
        assets: [...state.assets],
        commands: [...state.commands],
        componentState: { ...state.componentState },
        components: [...state.components],
        customInspectors: [...state.customInspectors],
        customTabs: [...state.customTabs],
        diagnostics: [...state.diagnostics],
        graph: [...state.graph],
        renderers: [...state.renderers],
        rootEvents: [...state.rootEvents],
        roots: [...state.roots],
        routes: [...state.routes],
        settings: { ...state.settings },
        timelineEvents: [...state.timelineEvents],
        timelineLayers: [...state.timelineLayers]
    };
}

function upsertById<TItem extends { id: number | string }>(
    items: TItem[],
    item: TItem
): TItem[] {
    return upsertByKey(items, item, 'id');
}

function upsertByKey<TItem, TKey extends keyof TItem>(
    items: TItem[],
    item: TItem,
    key: TKey
): TItem[] {
    const index = items.findIndex(
        (currentItem) => currentItem[key] === item[key]
    );

    if (index === -1) {
        return [...items, item];
    }

    return items.map((currentItem, currentIndex) =>
        currentIndex === index ? item : currentItem
    );
}
