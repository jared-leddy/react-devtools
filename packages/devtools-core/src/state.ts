import type {
    AssetInfo,
    ComponentNode,
    ComponentStateResponse,
    CustomInspectorRecord,
    DetectionDiagnosticRecord,
    DevToolsCoreState,
    DevToolsCoreStatePatch,
    FiberRootEventRecord,
    InspectModeState,
    InspectTargetRecord,
    ModuleGraphNode,
    PerformanceModeSettings,
    PerformanceModeSettingsPatch,
    RendererRecord,
    RootRecord,
    RouteRecord,
    SettingsRecord,
    TimelineEventRecord,
    TimelineLayerRecord,
    TreeRefreshDecision,
    TreeRefreshRequest,
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
    recordInspectHover(target: InspectTargetRecord | null): DevToolsCoreState;
    recordInspectSelection(target: InspectTargetRecord): DevToolsCoreState;
    recordTreeRefreshRequest(request: TreeRefreshRequest): TreeRefreshDecision;
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
    setHighPerformanceMode(enabled: boolean): DevToolsCoreState;
    setInspectMode(enabled: boolean): DevToolsCoreState;
    setPerformanceSettings(
        settings: PerformanceModeSettingsPatch
    ): DevToolsCoreState;
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
        inspectMode: createDefaultInspectModeState(),
        performance: createDefaultPerformanceModeState(),
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
            const performanceUpdate =
                rootEvent.lifecycle === 'committed'
                    ? applyCommitPerformanceThreshold(
                          state.performance,
                          rootEvent.timestamp
                      )
                    : {
                          diagnostics: [],
                          performance: state.performance
                      };

            return update({
                diagnostics: [
                    ...state.diagnostics,
                    ...performanceUpdate.diagnostics.filter(
                        (diagnostic) =>
                            !state.diagnostics.some(
                                (currentDiagnostic) =>
                                    currentDiagnostic.id === diagnostic.id
                            )
                    )
                ],
                performance: performanceUpdate.performance,
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
        recordInspectHover(target) {
            return update({
                inspectMode: {
                    ...state.inspectMode,
                    hoveredTarget: target
                }
            });
        },
        recordInspectSelection(target) {
            return update({
                inspectMode: {
                    enabled: false,
                    hoveredTarget: null,
                    lastSelectedTarget: target
                },
                selectedComponentId:
                    target.componentId ?? state.selectedComponentId,
                selectedRootId: target.rootId ?? state.selectedRootId
            });
        },
        recordTreeRefreshRequest(request) {
            const { performance } = state;
            const { settings } = performance;
            const elapsedSinceRefresh =
                performance.flags.lastTreeRefreshAt === null
                    ? Number.POSITIVE_INFINITY
                    : request.requestedAt - performance.flags.lastTreeRefreshAt;

            if (
                settings.enabled &&
                settings.pauseExpensiveTreeRefreshes &&
                elapsedSinceRefresh < settings.commitDebounceMs
            ) {
                const nextAllowedAt =
                    (performance.flags.lastTreeRefreshAt ??
                        request.requestedAt) + settings.commitDebounceMs;
                const diagnostic = createPerformanceDiagnostic({
                    code: 'refresh-throttled',
                    details: {
                        nextAllowedAt,
                        reason: request.reason
                    },
                    id: `performance:refresh-throttled:${request.requestedAt}`,
                    message: `Tree refresh was throttled for ${settings.commitDebounceMs}ms high-performance debounce.`,
                    severity: 'warning',
                    timestamp: request.requestedAt
                });

                update({
                    diagnostics: upsertById(state.diagnostics, diagnostic),
                    performance: {
                        ...performance,
                        flags: {
                            ...performance.flags,
                            treeRefreshPaused: true
                        }
                    }
                });

                return {
                    allowed: false,
                    diagnostic,
                    nextAllowedAt
                };
            }

            update({
                performance: {
                    ...performance,
                    flags: {
                        ...performance.flags,
                        lastTreeRefreshAt: request.requestedAt,
                        treeRefreshPaused: false
                    }
                }
            });

            return { allowed: true };
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
            const limitedTree = applyComponentTreeLimits(
                components,
                state.performance.settings
            );

            return update({
                components: limitedTree.components,
                diagnostics: [
                    ...state.diagnostics,
                    ...limitedTree.diagnostics.filter(
                        (diagnostic) =>
                            !state.diagnostics.some(
                                (currentDiagnostic) =>
                                    currentDiagnostic.id === diagnostic.id
                            )
                    )
                ]
            });
        },
        setGraph(graph) {
            return update({ graph });
        },
        setHighPerformanceMode(enabled) {
            return update({
                performance: {
                    ...state.performance,
                    flags: {
                        ...state.performance.flags,
                        pluginSetupPaused:
                            enabled &&
                            state.performance.settings.pausePluginSetup,
                        treeRefreshPaused:
                            enabled &&
                            state.performance.settings
                                .pauseExpensiveTreeRefreshes
                    },
                    settings: {
                        ...state.performance.settings,
                        enabled
                    }
                }
            });
        },
        setInspectMode(enabled) {
            return update({
                inspectMode: {
                    ...state.inspectMode,
                    enabled,
                    hoveredTarget: enabled
                        ? state.inspectMode.hoveredTarget
                        : null
                }
            });
        },
        setPerformanceSettings(settings) {
            const nextSettings = {
                ...state.performance.settings,
                ...settings
            };

            return update({
                performance: {
                    ...state.performance,
                    flags: {
                        ...state.performance.flags,
                        pluginSetupPaused:
                            nextSettings.enabled &&
                            nextSettings.pausePluginSetup,
                        treeRefreshPaused:
                            nextSettings.enabled &&
                            nextSettings.pauseExpensiveTreeRefreshes
                    },
                    settings: nextSettings
                }
            });
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
        inspectMode: {
            ...state.inspectMode,
            hoveredTarget: cloneInspectTarget(state.inspectMode.hoveredTarget),
            lastSelectedTarget: cloneInspectTarget(
                state.inspectMode.lastSelectedTarget
            )
        },
        performance: {
            flags: { ...state.performance.flags },
            settings: { ...state.performance.settings }
        },
        renderers: [...state.renderers],
        rootEvents: [...state.rootEvents],
        roots: [...state.roots],
        routes: [...state.routes],
        settings: { ...state.settings },
        timelineEvents: [...state.timelineEvents],
        timelineLayers: [...state.timelineLayers]
    };
}

function createDefaultInspectModeState(): InspectModeState {
    return {
        enabled: false,
        hoveredTarget: null,
        lastSelectedTarget: null
    };
}

function createDefaultPerformanceModeState(): DevToolsCoreState['performance'] {
    return {
        flags: {
            commitCountInWindow: 0,
            lastCommitAt: null,
            lastTreeRefreshAt: null,
            pluginSetupPaused: false,
            treeRefreshPaused: false,
            windowStartedAt: null
        },
        settings: {
            autoPauseCommitThreshold: 120,
            autoPauseWindowMs: 1000,
            commitDebounceMs: 100,
            enabled: false,
            maxNodeCount: 2500,
            maxTreeDepth: 50,
            pauseExpensiveTreeRefreshes: true,
            pausePluginSetup: false
        }
    };
}

function cloneInspectTarget(
    target: InspectTargetRecord | null
): InspectTargetRecord | null {
    if (!target) {
        return null;
    }

    return {
        ...target,
        domRect: target.domRect ? { ...target.domRect } : undefined,
        source: target.source ? { ...target.source } : undefined
    };
}

function applyComponentTreeLimits(
    components: ComponentNode[],
    settings: PerformanceModeSettings
): {
    components: ComponentNode[];
    diagnostics: DetectionDiagnosticRecord[];
} {
    if (!settings.enabled) {
        return { components, diagnostics: [] };
    }

    const diagnostics: DetectionDiagnosticRecord[] = [];
    let nodeCount = 0;
    let depthTruncated = false;
    let nodeLimitTruncated = false;

    const visit = (nodes: ComponentNode[], depth: number): ComponentNode[] => {
        const limitedNodes: ComponentNode[] = [];

        for (const node of nodes) {
            if (nodeCount >= settings.maxNodeCount) {
                nodeLimitTruncated = true;
                break;
            }

            nodeCount += 1;
            const nextNode = { ...node };

            if (node.children && node.children.length > 0) {
                if (depth >= settings.maxTreeDepth) {
                    depthTruncated = true;
                    nextNode.children = [];
                } else {
                    nextNode.children = visit(node.children, depth + 1);
                }
            }

            limitedNodes.push(nextNode);
        }

        return limitedNodes;
    };

    const limitedComponents = visit(components, 1);
    const timestamp = Date.now();

    if (depthTruncated) {
        diagnostics.push(
            createPerformanceDiagnostic({
                code: 'tree-depth-truncated',
                details: {
                    maxTreeDepth: settings.maxTreeDepth
                },
                id: `performance:tree-depth-truncated:${settings.maxTreeDepth}`,
                message: `Component tree was truncated at depth ${settings.maxTreeDepth}.`,
                severity: 'warning',
                timestamp
            })
        );
    }

    if (nodeLimitTruncated) {
        diagnostics.push(
            createPerformanceDiagnostic({
                code: 'tree-node-limit-truncated',
                details: {
                    maxNodeCount: settings.maxNodeCount
                },
                id: `performance:tree-node-limit-truncated:${settings.maxNodeCount}`,
                message: `Component tree was truncated after ${settings.maxNodeCount} nodes.`,
                severity: 'warning',
                timestamp
            })
        );
    }

    return { components: limitedComponents, diagnostics };
}

function applyCommitPerformanceThreshold(
    performance: DevToolsCoreState['performance'],
    timestamp: number
): {
    diagnostics: DetectionDiagnosticRecord[];
    performance: DevToolsCoreState['performance'];
} {
    const { settings } = performance;

    if (!settings.enabled || settings.autoPauseCommitThreshold <= 0) {
        return {
            diagnostics: [],
            performance: {
                ...performance,
                flags: {
                    ...performance.flags,
                    lastCommitAt: timestamp
                }
            }
        };
    }

    const windowStartedAt =
        performance.flags.windowStartedAt === null ||
        timestamp - performance.flags.windowStartedAt >
            settings.autoPauseWindowMs
            ? timestamp
            : performance.flags.windowStartedAt;
    const commitCountInWindow =
        windowStartedAt === timestamp
            ? 1
            : performance.flags.commitCountInWindow + 1;
    const shouldPause =
        commitCountInWindow >= settings.autoPauseCommitThreshold;
    const diagnostic = shouldPause
        ? createPerformanceDiagnostic({
              code: 'auto-paused',
              details: {
                  autoPauseCommitThreshold: settings.autoPauseCommitThreshold,
                  autoPauseWindowMs: settings.autoPauseWindowMs,
                  commitCountInWindow
              },
              id: `performance:auto-paused:${windowStartedAt}`,
              message: `High-performance mode paused expensive refreshes after ${commitCountInWindow} commits in ${settings.autoPauseWindowMs}ms.`,
              severity: 'warning',
              timestamp
          })
        : undefined;

    return {
        diagnostics: diagnostic ? [diagnostic] : [],
        performance: {
            ...performance,
            flags: {
                ...performance.flags,
                commitCountInWindow,
                lastCommitAt: timestamp,
                pluginSetupPaused:
                    shouldPause && settings.pausePluginSetup
                        ? true
                        : performance.flags.pluginSetupPaused,
                treeRefreshPaused:
                    shouldPause && settings.pauseExpensiveTreeRefreshes
                        ? true
                        : performance.flags.treeRefreshPaused,
                windowStartedAt
            }
        }
    };
}

function createPerformanceDiagnostic(
    diagnostic: DetectionDiagnosticRecord
): DetectionDiagnosticRecord {
    return diagnostic;
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
