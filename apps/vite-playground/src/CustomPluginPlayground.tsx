import { useCallback, useEffect, useState } from 'react';
import {
    addCustomCommand,
    addCustomTab,
    editCustomInspectorState,
    getCustomCommands,
    getCustomInspectors,
    getCustomTabs,
    sendCustomInspectorState,
    sendCustomInspectorTree,
    setupDevToolsPlugin
} from '@devtools/kit';
import type {
    CustomInspectorNode,
    InspectorState,
    InspectorStateEntry
} from '@devtools/kit';

const CUSTOM_PLUGIN_ID = 'vite-custom-plugin-playground';
const CUSTOM_INSPECTOR_ID = 'vite-custom-plugin-inspector';
const CUSTOM_LAYER_ID = 'vite-custom-plugin-timeline';
const REACT_TAB_NAME = 'vite-custom-plugin-react-tab';
const IFRAME_TAB_NAME = 'vite-custom-plugin-iframe-tab';
const ROOT_NODE_ID = 'plugin-root';

const customInspectorTree: CustomInspectorNode[] = [
    {
        id: ROOT_NODE_ID,
        label: 'Vite dogfood plugin',
        tags: [{ label: 'editable', backgroundColor: '#67d3f3' }],
        children: [
            {
                id: 'commands',
                label: 'Command registry',
                tags: [{ label: 'custom command' }]
            },
            {
                id: 'tabs',
                label: 'Custom tabs',
                tags: [{ label: 'react + iframe' }]
            },
            {
                id: 'timeline',
                label: 'Timeline layer',
                tags: [{ label: 'events' }]
            }
        ]
    }
];

const inspectorStateByNode = new Map<string, InspectorState>([
    [
        ROOT_NODE_ID,
        {
            Plugin: [
                { key: 'label', value: 'Vite dogfood plugin', editable: true },
                { key: 'enabled', value: true, editable: true }
            ],
            Dogfood: [
                { key: 'commands', value: 1 },
                { key: 'customTabs', value: 2 },
                { key: 'timelineLayer', value: CUSTOM_LAYER_ID }
            ]
        }
    ],
    [
        'commands',
        {
            Commands: [
                { key: 'primary', value: 'Refresh fake inspector' },
                { key: 'child', value: 'Open iframe tab' }
            ]
        }
    ],
    [
        'tabs',
        {
            Tabs: [
                { key: 'reactTab', value: REACT_TAB_NAME },
                { key: 'iframeTab', value: IFRAME_TAB_NAME }
            ]
        }
    ],
    [
        'timeline',
        {
            Timeline: [
                { key: 'layer', value: CUSTOM_LAYER_ID },
                { key: 'events', value: 'registration + edits' }
            ]
        }
    ]
]);

interface RegistrySummary {
    commandCount: number;
    editableLabel: string;
    inspectorCount: number;
    nodeCount: number;
    status: string;
    tabCount: number;
}

function cloneState(state: InspectorState): InspectorState {
    return Object.fromEntries(
        Object.entries(state).map(([category, entries]) => [
            category,
            entries.map((entry) => ({ ...entry }))
        ])
    );
}

function getStateEntry(
    state: InspectorState,
    category: string,
    key: string
): InspectorStateEntry | undefined {
    return state[category]?.find((entry) => entry.key === key);
}

function countNodes(nodes: CustomInspectorNode[]): number {
    return nodes.reduce(
        (total, node) => total + 1 + countNodes(node.children ?? []),
        0
    );
}

function filterTree(
    nodes: CustomInspectorNode[],
    filter: string | undefined
): CustomInspectorNode[] {
    if (!filter) {
        return nodes;
    }

    const normalizedFilter = filter.toLowerCase();

    return nodes
        .map((node) => ({
            ...node,
            children: filterTree(node.children ?? [], normalizedFilter)
        }))
        .filter(
            (node) =>
                node.label.toLowerCase().includes(normalizedFilter) ||
                (node.children?.length ?? 0) > 0
        );
}

function updateEditableEntry(
    payload: Parameters<typeof editCustomInspectorState>[0]
): void {
    const state = inspectorStateByNode.get(payload.nodeId);
    const [category, indexOrKey] = payload.path;

    if (!state || typeof category !== 'string') {
        return;
    }

    const entry =
        typeof indexOrKey === 'number'
            ? state[category]?.[indexOrKey]
            : getStateEntry(state, category, String(indexOrKey));

    if (!entry?.editable) {
        return;
    }

    entry.value = payload.state.value;
}

function registerCustomPluginPlayground(): void {
    setupDevToolsPlugin(
        {
            id: CUSTOM_PLUGIN_ID,
            label: 'Vite Custom Plugin Playground',
            packageName: '@devtools/vite-playground',
            settings: {
                editableFixture: {
                    defaultValue: true,
                    label: 'Editable inspector fixture',
                    type: 'boolean'
                }
            }
        },
        (api) => {
            api.addInspector({
                id: CUSTOM_INSPECTOR_ID,
                label: 'Vite custom plugin',
                icon: 'plug',
                noSelectionText: 'Select a custom plugin fixture node',
                treeFilterPlaceholder: 'Filter fake plugin nodes',
                stateFilterPlaceholder: 'Filter editable state fields',
                actions: [
                    {
                        action: 'refresh',
                        icon: 'refresh-cw',
                        label: 'Refresh'
                    }
                ],
                nodeActions: [
                    {
                        action: 'select',
                        icon: 'mouse-pointer-click',
                        label: 'Select node'
                    }
                ]
            });

            api.on.getInspectorTree(CUSTOM_INSPECTOR_ID, ({ filter }) => ({
                inspectorId: CUSTOM_INSPECTOR_ID,
                rootNodes: filterTree(customInspectorTree, filter)
            }));

            api.on.getInspectorState(CUSTOM_INSPECTOR_ID, ({ nodeId }) => ({
                inspectorId: CUSTOM_INSPECTOR_ID,
                nodeId,
                state: cloneState(inspectorStateByNode.get(nodeId) ?? {})
            }));

            api.on.editInspectorState(CUSTOM_INSPECTOR_ID, (payload) => {
                updateEditableEntry(payload);
                api.setInspectorState(
                    payload.inspectorId,
                    payload.nodeId,
                    cloneState(inspectorStateByNode.get(payload.nodeId) ?? {})
                );
                api.addTimelineEvent({
                    layerId: CUSTOM_LAYER_ID,
                    title: 'Inspector state edited',
                    subtitle: String(payload.path.join('.')),
                    data: payload,
                    time: api.now()
                });
            });

            api.addTimelineLayer({
                id: CUSTOM_LAYER_ID,
                label: 'Custom plugin playground',
                color: '#67d3f3'
            });
            api.addTimelineEvent({
                layerId: CUSTOM_LAYER_ID,
                title: 'Custom plugin registered',
                subtitle: 'Inspector, commands, tabs, and timeline ready',
                data: { inspectorId: CUSTOM_INSPECTOR_ID },
                time: api.now()
            });
        }
    );

    addCustomCommand({
        id: 'vite-custom-plugin-refresh',
        label: 'Refresh fake inspector',
        icon: 'refresh-cw',
        order: 10,
        action: () => {
            inspectorStateByNode.set(ROOT_NODE_ID, {
                ...cloneState(inspectorStateByNode.get(ROOT_NODE_ID) ?? {}),
                Dogfood: [
                    { key: 'commands', value: getCustomCommands().length },
                    { key: 'customTabs', value: getCustomTabs().length },
                    { key: 'timelineLayer', value: CUSTOM_LAYER_ID }
                ]
            });
        },
        children: [
            {
                id: 'vite-custom-plugin-open-iframe-tab',
                label: 'Open iframe tab',
                icon: 'panel-top',
                route: `/custom-tabs/${IFRAME_TAB_NAME}`
            }
        ]
    });

    addCustomTab({
        name: REACT_TAB_NAME,
        title: 'Plugin React Tab',
        category: 'Vite playground',
        icon: 'component',
        path: '/custom-plugin/react',
        persist: true,
        view: {
            kind: 'react',
            title: 'React-rendered custom plugin tab'
        }
    });

    addCustomTab({
        name: IFRAME_TAB_NAME,
        title: 'Plugin Iframe Tab',
        category: 'Vite playground',
        icon: 'panel-top',
        iframeUrl:
            'data:text/html,<main style="font-family:sans-serif;color:%23f6f7fb;background:%23111318;padding:16px"><h1>Iframe custom tab</h1><p>Registered by the Vite custom plugin playground.</p></main>',
        persist: true,
        sandbox: 'allow-scripts allow-same-origin'
    });
}

export function CustomPluginPlayground() {
    const [summary, setSummary] = useState<RegistrySummary>({
        commandCount: 0,
        editableLabel: 'pending',
        inspectorCount: 0,
        nodeCount: 0,
        status: 'Registering custom plugin fixtures',
        tabCount: 0
    });

    const refreshSummary = useCallback(async (status: string) => {
        const [tree, state] = await Promise.all([
            sendCustomInspectorTree(CUSTOM_INSPECTOR_ID),
            sendCustomInspectorState(CUSTOM_INSPECTOR_ID, ROOT_NODE_ID)
        ]);
        const label = getStateEntry(state.state, 'Plugin', 'label');

        setSummary({
            commandCount: getCustomCommands().length,
            editableLabel: String(label?.value ?? 'missing'),
            inspectorCount: getCustomInspectors().length,
            nodeCount: countNodes(tree.rootNodes),
            status,
            tabCount: getCustomTabs().length
        });
    }, []);

    useEffect(() => {
        registerCustomPluginPlayground();
        void refreshSummary('Custom plugin fixtures registered');
    }, [refreshSummary]);

    const editInspectorLabel = async () => {
        await editCustomInspectorState({
            inspectorId: CUSTOM_INSPECTOR_ID,
            nodeId: ROOT_NODE_ID,
            path: ['Plugin', 'label'],
            state: { value: 'Edited from playground' },
            type: 'set'
        });
        await refreshSummary('Editable inspector state updated');
    };

    return (
        <section>
            <h2>Custom plugin API playground</h2>
            <div className="custom-plugin-layout">
                <article className="card">
                    <h3>Fake inspector</h3>
                    <p>
                        Registers a custom inspector with editable state,
                        actions, nested tree nodes, and devtools timeline
                        events.
                    </p>
                    <dl className="custom-plugin-metrics">
                        <div>
                            <dt>Inspectors</dt>
                            <dd data-testid="custom-plugin-inspector-count">
                                {summary.inspectorCount}
                            </dd>
                        </div>
                        <div>
                            <dt>Tree nodes</dt>
                            <dd data-testid="custom-plugin-node-count">
                                {summary.nodeCount}
                            </dd>
                        </div>
                        <div>
                            <dt>Editable label</dt>
                            <dd data-testid="custom-plugin-editable-label">
                                {summary.editableLabel}
                            </dd>
                        </div>
                    </dl>
                    <button type="button" onClick={editInspectorLabel}>
                        Edit inspector label
                    </button>
                </article>

                <article className="card">
                    <h3>Plugin surfaces</h3>
                    <p>
                        Dogfoods the command registry plus custom React and
                        iframe tabs before Nekuta depends on the same APIs.
                    </p>
                    <dl className="custom-plugin-metrics">
                        <div>
                            <dt>Commands</dt>
                            <dd data-testid="custom-plugin-command-count">
                                {summary.commandCount}
                            </dd>
                        </div>
                        <div>
                            <dt>Tabs</dt>
                            <dd data-testid="custom-plugin-tab-count">
                                {summary.tabCount}
                            </dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd data-testid="custom-plugin-status">
                                {summary.status}
                            </dd>
                        </div>
                    </dl>
                </article>
            </div>
        </section>
    );
}
