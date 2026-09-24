import type { ComponentType, ReactElement, ReactNode } from 'react';
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore
} from 'react';
import {
    MemoryRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
    useSearchParams,
    type MemoryRouterProps
} from 'react-router';
import {
    Card,
    ThemeProvider,
    useTheme,
    type NotificationTone
} from '@devtools/ui';
import {
    editCustomInspectorState,
    sendCustomInspectorState,
    sendCustomInspectorTree,
    type CustomInspectorAction,
    type CustomInspectorNode,
    type CustomInspectorOptions,
    type CustomTab,
    type InspectorState,
    type InspectorStateEntry
} from '@devtools/kit';
import '@devtools/ui/style.css';
import './style.css';
import {
    getClientCommandSnapshot,
    getVisibleClientCommands,
    subscribeToClientCommands,
    type ClientCommand
} from './commands';
import { ResizableSplitPane } from './components/layout';
import {
    StateViewer,
    type StateViewerCustomValue,
    type StateViewerEditOperation,
    type StateViewerField,
    type StateViewerSection,
    type StateViewerValue
} from './components/state';
import {
    VirtualizedComponentTree,
    findComponentTreeNode,
    generateSyntheticComponentTree
} from './components/tree';
import {
    getClientOverviewSnapshot,
    type ClientOverviewIntegration,
    type ClientOverviewRenderer,
    type ClientOverviewRoot,
    type ClientOverviewSnapshot
} from './overview';
import {
    getClientRouteCategories,
    getPersistedLastClientRoutePath,
    getVisibleClientRoutes,
    initializeClientRouteRegistry,
    persistClientRouteVisit,
    subscribeToClientRoutes,
    type ClientRoute
} from './routing';
import {
    getClientRuntimeSnapshot,
    subscribeToClientRuntime,
    type ClientRuntimeSnapshot
} from './runtime';
import {
    exportClientSettings,
    getClientSettingsSnapshot,
    importClientSettings,
    resetClientSettings,
    setClientSetting,
    subscribeToClientSettings,
    type ClientSettingsSnapshot
} from './settings';

export interface AppProps {
    initialEntries?: MemoryRouterProps['initialEntries'];
    router?: 'memory' | 'none';
}

const placeholderToneByKind: Record<ClientRoute['kind'], NotificationTone> = {
    customInspector: 'info',
    customTab: 'info',
    page: 'success'
};
const syntheticComponentTree = generateSyntheticComponentTree();

function ClientShell() {
    const navigate = useNavigate();
    const [commandFilter, setCommandFilter] = useState('');
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const settingsSnapshot = useSyncExternalStore(
        subscribeToClientSettings,
        getClientSettingsSnapshot,
        getClientSettingsSnapshot
    );
    const routeSnapshot = useSyncExternalStore(
        subscribeToClientRoutes,
        initializeClientRouteRegistry,
        initializeClientRouteRegistry
    );
    const routes = useMemo(
        () => getVisibleClientRoutes(routeSnapshot),
        [routeSnapshot]
    );
    const routeCategories = useMemo(
        () => getClientRouteCategories(routes),
        [routes]
    );
    const defaultRoutePath = getPersistedLastClientRoutePath(routes);
    const runtimeSnapshot = useSyncExternalStore(
        subscribeToClientRuntime,
        getClientRuntimeSnapshot,
        getClientRuntimeSnapshot
    );
    const commandSnapshot = useSyncExternalStore(
        subscribeToClientCommands,
        getClientCommandSnapshot,
        getClientCommandSnapshot
    );
    const commands = useMemo(
        () =>
            getVisibleClientCommands({
                customCommands: commandSnapshot.customCommands,
                routes
            }),
        [commandSnapshot.customCommands, routes]
    );

    useEffect(() => {
        function handleCommandShortcut(event: KeyboardEvent) {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        }

        window.addEventListener('keydown', handleCommandShortcut);

        return () => {
            window.removeEventListener('keydown', handleCommandShortcut);
        };
    }, []);

    const runCommand = (command: ClientCommand) => {
        setIsCommandPaletteOpen(false);
        setCommandFilter('');

        if (command.route) {
            navigate(command.route);
            return;
        }

        if (command.url) {
            window.open(command.url, '_blank', 'noopener,noreferrer');
            return;
        }

        void command.action?.();
    };

    return (
        <ThemeProvider defaultTheme={settingsSnapshot.theme}>
            <main
                className="dt-client-shell"
                aria-label="React DevTools client"
                data-panel-layout={settingsSnapshot.panelLayout}
                data-reduce-motion={settingsSnapshot.reduceMotion}
            >
                <ClientThemeBridge theme={settingsSnapshot.theme} />
                <header className="dt-client-shell__header">
                    <div className="dt-client-shell__masthead">
                        <h1>React DevTools</h1>
                        <div className="dt-client-shell__actions">
                            <button
                                className="dt-client-shell__command-button"
                                onClick={() => {
                                    setIsCommandPaletteOpen(true);
                                }}
                                type="button"
                            >
                                Command
                            </button>
                            <ClientThemeToggle theme={settingsSnapshot.theme} />
                        </div>
                    </div>
                    <nav
                        className="dt-client-shell__nav"
                        aria-label="Panel tabs"
                    >
                        {routeCategories.map((group) => (
                            <div
                                className="dt-client-shell__nav-group"
                                data-route-category={group.category}
                                key={group.category}
                            >
                                {group.routes.map((route) => (
                                    <NavLink
                                        className={({ isActive }) =>
                                            `dt-client-shell__tab${
                                                isActive
                                                    ? ' dt-client-shell__tab--active'
                                                    : ''
                                            }`
                                        }
                                        key={route.id}
                                        to={route.path}
                                    >
                                        {route.label}
                                    </NavLink>
                                ))}
                            </div>
                        ))}
                    </nav>
                </header>

                <Routes>
                    <Route
                        path="/"
                        element={<Navigate to={defaultRoutePath} replace />}
                    />
                    {routes.map((route) => (
                        <Route
                            element={
                                <TrackedRoutePage
                                    route={route}
                                    runtimeSnapshot={runtimeSnapshot}
                                    settingsSnapshot={settingsSnapshot}
                                />
                            }
                            key={route.id}
                            path={route.path}
                        />
                    ))}
                    <Route
                        path="*"
                        element={
                            <RoutePage
                                route={{
                                    category: 'core',
                                    id: 'not-found',
                                    kind: 'page',
                                    label: 'Not found',
                                    path: '/not-found',
                                    summary:
                                        'That panel route is not registered yet.'
                                }}
                            />
                        }
                    />
                </Routes>
                {isCommandPaletteOpen ? (
                    <CommandPalette
                        commands={commands}
                        filter={commandFilter}
                        onClose={() => {
                            setIsCommandPaletteOpen(false);
                            setCommandFilter('');
                        }}
                        onFilterChange={setCommandFilter}
                        onRunCommand={runCommand}
                    />
                ) : null}
            </main>
        </ThemeProvider>
    );
}

function CommandPalette({
    commands,
    filter,
    onClose,
    onFilterChange,
    onRunCommand
}: {
    commands: ClientCommand[];
    filter: string;
    onClose: () => void;
    onFilterChange: (value: string) => void;
    onRunCommand: (command: ClientCommand) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const filteredCommands = useMemo(() => {
        const normalizedFilter = filter.trim().toLowerCase();

        if (!normalizedFilter) {
            return commands;
        }

        return commands.filter((command) =>
            [command.label, ...command.group]
                .join(' ')
                .toLowerCase()
                .includes(normalizedFilter)
        );
    }, [commands, filter]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div
            aria-label="Command palette"
            aria-modal="true"
            className="dt-command-palette"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    onClose();
                }
            }}
            role="dialog"
        >
            <div className="dt-command-palette__panel">
                <input
                    aria-label="Search commands"
                    className="dt-command-palette__input"
                    onChange={(event) => {
                        onFilterChange(event.target.value);
                    }}
                    placeholder="Search commands"
                    ref={inputRef}
                    type="search"
                    value={filter}
                />
                <div className="dt-command-palette__list" role="listbox">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((command) => (
                            <button
                                className="dt-command-palette__item"
                                key={command.id}
                                onClick={() => {
                                    onRunCommand(command);
                                }}
                                role="option"
                                type="button"
                            >
                                <span>{command.label}</span>
                                <small>{command.group.join(' / ')}</small>
                            </button>
                        ))
                    ) : (
                        <p className="dt-command-palette__empty">
                            No commands found
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function TrackedRoutePage({
    route,
    runtimeSnapshot,
    settingsSnapshot
}: {
    route: ClientRoute;
    runtimeSnapshot: ClientRuntimeSnapshot;
    settingsSnapshot: ClientSettingsSnapshot;
}) {
    const location = useLocation();

    useEffect(() => {
        persistClientRouteVisit(
            route,
            `${location.pathname}${location.search}`
        );
    }, [location.pathname, location.search, route]);

    return (
        <RoutePage
            route={route}
            runtimeSnapshot={runtimeSnapshot}
            settingsSnapshot={settingsSnapshot}
        />
    );
}

function RoutePage({
    route,
    runtimeSnapshot = getClientRuntimeSnapshot(),
    settingsSnapshot = getClientSettingsSnapshot()
}: {
    route: ClientRoute;
    runtimeSnapshot?: ClientRuntimeSnapshot;
    settingsSnapshot?: ClientSettingsSnapshot;
}) {
    const runtimeBlock = getRuntimeBlock(runtimeSnapshot);

    if (route.id === 'overview') {
        const routeSnapshot = initializeClientRouteRegistry();
        const overviewSnapshot = getClientOverviewSnapshot({
            routeSnapshot,
            runtimeSnapshot,
            settingsSnapshot,
            visibleRouteCount: getVisibleClientRoutes(routeSnapshot).length
        });

        return <OverviewPage snapshot={overviewSnapshot} />;
    }

    if (runtimeBlock) {
        return <RuntimeStatePage state={runtimeBlock} />;
    }

    if (route.id === 'components') {
        return (
            <ComponentsPage
                runtimeSnapshot={runtimeSnapshot}
                settingsSnapshot={settingsSnapshot}
            />
        );
    }

    if (route.id === 'settings') {
        return <SettingsPage settingsSnapshot={settingsSnapshot} />;
    }

    if (route.kind === 'customInspector') {
        const routeSnapshot = initializeClientRouteRegistry();
        const inspector = routeSnapshot.customInspectors.find(
            (item) => `custom-inspector:${item.id}` === route.id
        );

        return inspector ? (
            <CustomInspectorPage
                inspector={inspector}
                settingsSnapshot={settingsSnapshot}
            />
        ) : (
            <RuntimeStatePage
                state={{
                    description:
                        'The custom inspector route exists, but the plugin inspector registration is no longer available.',
                    label: 'custom-inspector-missing',
                    title: 'Inspector unavailable',
                    tone: 'warning'
                }}
            />
        );
    }

    if (route.kind === 'customTab') {
        const routeSnapshot = initializeClientRouteRegistry();
        const tab = routeSnapshot.customTabs.find(
            (item) => `custom-tab:${item.name}` === route.id
        );

        return tab ? (
            <CustomTabPage tab={tab} />
        ) : (
            <RuntimeStatePage
                state={{
                    description:
                        'The custom tab route exists, but the plugin tab registration is no longer available.',
                    label: 'custom-tab-missing',
                    title: 'Custom tab unavailable',
                    tone: 'warning'
                }}
            />
        );
    }

    return (
        <Card title={route.label}>
            <section
                aria-label={`${route.label} page`}
                className="dt-client-shell__page"
                data-route-kind={route.kind}
            >
                <p className="dt-client-shell__copy">{route.summary}</p>
                <span
                    className={`dt-client-shell__badge dt-client-shell__badge--${
                        placeholderToneByKind[route.kind]
                    }`}
                >
                    {route.kind}
                </span>
            </section>
        </Card>
    );
}

function OverviewPage({ snapshot }: { snapshot: ClientOverviewSnapshot }) {
    return (
        <section
            aria-label="Overview page"
            className="dt-client-shell__page dt-overview-page"
        >
            <Card title="Overview">
                <div className="dt-overview-summary">
                    <OverviewMetric
                        label="Transport"
                        value={formatOverviewValue(
                            snapshot.diagnostics.deliveryMode
                        )}
                    />
                    <OverviewMetric
                        label="Connection"
                        value={formatOverviewValue(
                            snapshot.diagnostics.connectionStatus
                        )}
                    />
                    <OverviewMetric
                        label="Last commit"
                        value={snapshot.diagnostics.lastCommitTime}
                    />
                    <OverviewMetric
                        label="Routes"
                        value={String(snapshot.diagnostics.visibleRouteCount)}
                    />
                </div>
            </Card>
            <div className="dt-overview-grid">
                <Card title="React renderers">
                    <RendererList renderers={snapshot.renderers} />
                </Card>
                <Card title="Roots">
                    <RootList roots={snapshot.roots} />
                </Card>
                <Card title="Integrations">
                    <IntegrationList integrations={snapshot.integrations} />
                </Card>
                <Card title="Performance diagnostics">
                    <dl className="dt-overview-details">
                        <OverviewDetail
                            label="High performance mode"
                            value={
                                snapshot.diagnostics.highPerformanceMode
                                    ? 'Enabled'
                                    : 'Disabled'
                            }
                        />
                        <OverviewDetail
                            label="Timeline recording"
                            value={
                                snapshot.diagnostics.timelineRecording
                                    ? 'Enabled'
                                    : 'Disabled'
                            }
                        />
                        <OverviewDetail
                            label="Last commit time"
                            value={snapshot.diagnostics.lastCommitTime}
                        />
                    </dl>
                </Card>
            </div>
        </section>
    );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
    return (
        <dl className="dt-overview-metric">
            <dt>{label}</dt>
            <dd>{value}</dd>
        </dl>
    );
}

function OverviewDetail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

function RendererList({ renderers }: { renderers: ClientOverviewRenderer[] }) {
    if (renderers.length === 0) {
        return (
            <EmptyPane
                label="No renderers detected"
                message="The inspected page is connected, but no React renderer has reported yet."
            />
        );
    }

    return (
        <ul className="dt-overview-list">
            {renderers.map((renderer) => (
                <li key={renderer.id}>
                    <strong>{renderer.name}</strong>
                    <span>{renderer.rendererPackage}</span>
                    <span>React {renderer.reactVersion}</span>
                    <span
                        className={`dt-client-shell__badge dt-client-shell__badge--${
                            renderer.status === 'unsupported'
                                ? 'warning'
                                : 'success'
                        }`}
                    >
                        {formatOverviewValue(renderer.status)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function RootList({ roots }: { roots: ClientOverviewRoot[] }) {
    if (roots.length === 0) {
        return (
            <EmptyPane
                label="No roots found"
                message="React was not detected yet, so there are no mounted roots to inspect."
            />
        );
    }

    return (
        <ul className="dt-overview-list">
            {roots.map((root) => (
                <li key={root.id}>
                    <strong>{root.name}</strong>
                    <span>{root.id}</span>
                    <span>{root.mountContainer}</span>
                    <span>Renderer {root.rendererId}</span>
                    <div className="dt-overview-tags">
                        <span>{formatOverviewValue(root.status)}</span>
                        {root.isIframe ? <span>iframe</span> : null}
                        {root.isPortal ? <span>portal</span> : null}
                    </div>
                </li>
            ))}
        </ul>
    );
}

function IntegrationList({
    integrations
}: {
    integrations: ClientOverviewIntegration[];
}) {
    return (
        <ul className="dt-overview-list">
            {integrations.map((integration) => (
                <li key={integration.id}>
                    <strong>{integration.label}</strong>
                    <span>{formatOverviewValue(integration.source)}</span>
                </li>
            ))}
        </ul>
    );
}

function CustomInspectorPage({
    inspector,
    settingsSnapshot
}: {
    inspector: CustomInspectorOptions;
    settingsSnapshot: ClientSettingsSnapshot;
}) {
    const [nodes, setNodes] = useState<Array<CustomInspectorNode>>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
    const [inspectorState, setInspectorState] = useState<InspectorState>({});
    const [activeSubview, setActiveSubview] = useState<
        'about' | 'inspector' | 'settings'
    >('inspector');
    const [status, setStatus] = useState('Inspector ready.');
    const [isLoadingTree, setIsLoadingTree] = useState(false);
    const [isLoadingState, setIsLoadingState] = useState(false);
    const filteredState = useMemo(
        () =>
            filterInspectorState(inspectorState, settingsSnapshot.stateFilter),
        [inspectorState, settingsSnapshot.stateFilter]
    );
    const stateSections = useMemo(
        () => toStateViewerSections(filteredState),
        [filteredState]
    );
    const selectedNode = selectedNodeId
        ? findInspectorNode(nodes, selectedNodeId)
        : undefined;

    useEffect(() => {
        let isMounted = true;
        setIsLoadingTree(true);
        void sendCustomInspectorTree(inspector.id, settingsSnapshot.treeFilter)
            .then((response) => {
                if (!isMounted) {
                    return;
                }

                setNodes(response.rootNodes);
                setSelectedNodeId((currentSelectedNodeId) => {
                    if (
                        currentSelectedNodeId &&
                        findInspectorNode(
                            response.rootNodes,
                            currentSelectedNodeId
                        )
                    ) {
                        return currentSelectedNodeId;
                    }

                    return response.rootNodes[0]?.id;
                });
                setStatus('Inspector tree loaded.');
            })
            .catch((error: unknown) => {
                if (!isMounted) {
                    return;
                }

                setStatus(
                    error instanceof Error
                        ? error.message
                        : 'Inspector tree failed to load.'
                );
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingTree(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [inspector.id, settingsSnapshot.treeFilter]);

    useEffect(() => {
        if (!selectedNodeId) {
            setInspectorState({});
            return;
        }

        let isMounted = true;
        setIsLoadingState(true);
        void sendCustomInspectorState(inspector.id, selectedNodeId)
            .then((response) => {
                if (!isMounted) {
                    return;
                }

                setInspectorState(response.state);
                setStatus(
                    `State loaded for ${selectedNode?.label ?? selectedNodeId}.`
                );
            })
            .catch((error: unknown) => {
                if (!isMounted) {
                    return;
                }

                setStatus(
                    error instanceof Error
                        ? error.message
                        : 'Inspector state failed to load.'
                );
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingState(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [inspector.id, selectedNode?.label, selectedNodeId]);

    const runAction = (
        action: CustomInspectorAction,
        scope: 'inspector' | 'node'
    ) => {
        const label = action.label ?? action.action;
        setStatus(
            `${scope === 'node' ? 'Node' : 'Inspector'} action queued: ${label}.`
        );
    };

    const editField = (
        field: StateViewerField,
        operation: StateViewerEditOperation
    ) => {
        if (!selectedNodeId || !field.path) {
            return;
        }

        setStatus(`Updating ${field.name}.`);
        void editCustomInspectorState({
            inspectorId: inspector.id,
            nodeId: selectedNodeId,
            path: field.path,
            state:
                operation.type === 'remove'
                    ? { remove: true }
                    : {
                          newKey: operation.newKey,
                          value: fromStateViewerValue(operation.value)
                      },
            type: operation.type
        })
            .then(() => {
                setInspectorState((currentState) =>
                    updateInspectorStateField(
                        currentState,
                        field.path!,
                        operation
                    )
                );
                setStatus(
                    operation.type === 'remove'
                        ? `Removed ${field.name}.`
                        : `Updated ${operation.newKey ?? field.name}.`
                );
            })
            .catch((error: unknown) => {
                setStatus(
                    error instanceof Error
                        ? error.message
                        : `Failed to update ${field.name}.`
                );
            });
    };

    return (
        <section
            aria-label={`${inspector.label} page`}
            className="dt-client-shell__page dt-custom-inspector"
        >
            <Card title={inspector.label}>
                <div className="dt-custom-inspector__toolbar">
                    <label>
                        Tree filter
                        <input
                            onChange={(event) => {
                                setClientSetting(
                                    'treeFilter',
                                    event.target.value
                                );
                            }}
                            placeholder={
                                inspector.treeFilterPlaceholder ?? 'Filter tree'
                            }
                            type="search"
                            value={settingsSnapshot.treeFilter}
                        />
                    </label>
                    <label>
                        State filter
                        <input
                            onChange={(event) => {
                                setClientSetting(
                                    'stateFilter',
                                    event.target.value
                                );
                            }}
                            placeholder={
                                inspector.stateFilterPlaceholder ??
                                'Filter state'
                            }
                            type="search"
                            value={settingsSnapshot.stateFilter}
                        />
                    </label>
                    <div
                        aria-label="Inspector subviews"
                        className="dt-custom-inspector__subviews"
                    >
                        {(['inspector', 'about', 'settings'] as const).map(
                            (subview) => (
                                <button
                                    aria-pressed={activeSubview === subview}
                                    key={subview}
                                    onClick={() => {
                                        setActiveSubview(subview);
                                    }}
                                    type="button"
                                >
                                    {formatOverviewValue(subview)}
                                </button>
                            )
                        )}
                    </div>
                </div>
                {inspector.actions?.length ? (
                    <ActionList
                        actions={inspector.actions}
                        label="Inspector actions"
                        onRunAction={(action) => {
                            runAction(action, 'inspector');
                        }}
                    />
                ) : null}
                <p className="dt-settings-status" role="status">
                    {isLoadingTree || isLoadingState
                        ? 'Loading inspector data.'
                        : status}
                </p>
            </Card>

            {activeSubview === 'inspector' ? (
                <ResizableSplitPane
                    left={
                        <Card title="Inspector tree">
                            <CustomInspectorTree
                                nodes={nodes}
                                onSelectNode={setSelectedNodeId}
                                selectedNodeId={selectedNodeId}
                            />
                        </Card>
                    }
                    leftLabel="Inspector tree"
                    right={
                        <Card title="Inspector state">
                            {selectedNode ? (
                                <div className="dt-custom-inspector__state">
                                    <div className="dt-custom-inspector__selection">
                                        <strong>{selectedNode.label}</strong>
                                        <span>{selectedNode.id}</span>
                                    </div>
                                    {inspector.nodeActions?.length ? (
                                        <ActionList
                                            actions={inspector.nodeActions}
                                            label="Node actions"
                                            onRunAction={(action) => {
                                                runAction(action, 'node');
                                            }}
                                        />
                                    ) : null}
                                    <StateViewer
                                        emptyLabel={
                                            inspector.noSelectionText ??
                                            'No state recorded for this inspector node.'
                                        }
                                        onEditField={editField}
                                        sections={stateSections}
                                    />
                                </div>
                            ) : (
                                <EmptyPane
                                    label="No inspector node selected"
                                    message={
                                        inspector.noSelectionText ??
                                        'Select a node from the custom inspector tree.'
                                    }
                                />
                            )}
                        </Card>
                    }
                    rightLabel="Inspector state"
                    storageKey={`devtools.client.inspector.${inspector.id}.splitRatio`}
                />
            ) : null}

            {activeSubview === 'about' ? (
                <Card title="About inspector">
                    <dl className="dt-overview-details">
                        <OverviewDetail
                            label="Inspector id"
                            value={inspector.id}
                        />
                        <OverviewDetail label="Label" value={inspector.label} />
                        <OverviewDetail
                            label="Tree nodes"
                            value={String(countInspectorNodes(nodes))}
                        />
                    </dl>
                </Card>
            ) : null}

            {activeSubview === 'settings' ? (
                <Card title="Inspector settings">
                    <EmptyPane
                        label="No inspector settings"
                        message="This custom inspector has not registered settings yet."
                    />
                </Card>
            ) : null}
        </section>
    );
}

function ActionList({
    actions,
    label,
    onRunAction
}: {
    actions: CustomInspectorAction[];
    label: string;
    onRunAction: (action: CustomInspectorAction) => void;
}) {
    return (
        <div aria-label={label} className="dt-custom-inspector__actions">
            {actions.map((action) => (
                <button
                    key={action.action}
                    onClick={() => {
                        onRunAction(action);
                    }}
                    title={action.tooltip}
                    type="button"
                >
                    {action.label ?? action.action}
                </button>
            ))}
        </div>
    );
}

function CustomInspectorTree({
    nodes,
    onSelectNode,
    selectedNodeId
}: {
    nodes: Array<CustomInspectorNode>;
    onSelectNode: (nodeId: string) => void;
    selectedNodeId?: string;
}) {
    if (nodes.length === 0) {
        return (
            <EmptyPane
                label="No inspector nodes"
                message="The plugin did not return custom inspector tree nodes."
            />
        );
    }

    return (
        <ul className="dt-custom-inspector__tree">
            {nodes.map((node) => (
                <CustomInspectorTreeNode
                    key={node.id}
                    node={node}
                    onSelectNode={onSelectNode}
                    selectedNodeId={selectedNodeId}
                />
            ))}
        </ul>
    );
}

function CustomInspectorTreeNode({
    node,
    onSelectNode,
    selectedNodeId
}: {
    node: CustomInspectorNode;
    onSelectNode: (nodeId: string) => void;
    selectedNodeId?: string;
}) {
    return (
        <li>
            <button
                aria-pressed={selectedNodeId === node.id}
                onClick={() => {
                    onSelectNode(node.id);
                }}
                type="button"
            >
                <span>{node.label}</span>
                {node.tags?.map((tag) => (
                    <small key={tag.label}>{tag.label}</small>
                ))}
            </button>
            {node.children?.length ? (
                <ul>
                    {node.children.map((child) => (
                        <CustomInspectorTreeNode
                            key={child.id}
                            node={child}
                            onSelectNode={onSelectNode}
                            selectedNodeId={selectedNodeId}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function CustomTabPage({ tab }: { tab: CustomTab }) {
    const [status, setStatus] = useState('Custom tab ready.');
    const renderedTab = getCustomTabRenderState(tab);
    const setErrorStatus = useCallback((message: string) => {
        setStatus(message);
    }, []);
    const setReactLoaded = useCallback(() => {
        setStatus('Custom React tab loaded.');
    }, []);
    const setDynamicLoaded = useCallback(() => {
        setStatus('Custom dynamic tab loaded.');
    }, []);

    return (
        <section
            aria-label={`${tab.title} page`}
            className="dt-client-shell__page dt-custom-tab"
        >
            <Card title={tab.title}>
                <div className="dt-custom-tab__summary">
                    <span
                        className={`dt-client-shell__badge dt-client-shell__badge--${
                            renderedTab.kind === 'error' ? 'warning' : 'info'
                        }`}
                    >
                        {renderedTab.label}
                    </span>
                    <span>{tab.name}</span>
                    {tab.persist ? <span>Persisted iframe</span> : null}
                </div>
                <p className="dt-settings-status" role="status">
                    {status}
                </p>
            </Card>
            <Card title="Custom tab content">
                {renderedTab.kind === 'iframe' ? (
                    <iframe
                        className="dt-custom-tab__iframe"
                        data-persist={tab.persist ? 'true' : 'false'}
                        onError={() => {
                            setStatus('Custom iframe failed to load.');
                        }}
                        onLoad={() => {
                            setStatus('Custom iframe loaded.');
                        }}
                        sandbox={renderedTab.sandbox}
                        src={renderedTab.src}
                        title={tab.title}
                    />
                ) : null}
                {renderedTab.kind === 'react' ? (
                    <CustomTabReactView
                        onError={setErrorStatus}
                        onLoaded={setReactLoaded}
                        view={renderedTab.view}
                    />
                ) : null}
                {renderedTab.kind === 'dynamic' ? (
                    <CustomTabDynamicView
                        loader={renderedTab.loader}
                        onError={setErrorStatus}
                        onLoaded={setDynamicLoaded}
                    />
                ) : null}
                {renderedTab.kind === 'empty' ? (
                    <EmptyPane
                        label="No custom tab view"
                        message="This plugin registered a tab without iframe or React content."
                    />
                ) : null}
                {renderedTab.kind === 'error' ? (
                    <EmptyPane
                        label="Custom tab blocked"
                        message={renderedTab.message}
                    />
                ) : null}
            </Card>
        </section>
    );
}

function CustomTabReactView({
    onError,
    onLoaded,
    view
}: {
    onError: (message: string) => void;
    onLoaded: () => void;
    view: ComponentType | ReactElement;
}) {
    useEffect(() => {
        onLoaded();
    }, [onLoaded]);

    try {
        if (isReactElement(view)) {
            return <div className="dt-custom-tab__react">{view}</div>;
        }

        const View = view;

        return (
            <div className="dt-custom-tab__react">
                <View />
            </div>
        );
    } catch (error) {
        onError(
            error instanceof Error
                ? error.message
                : 'Custom React tab failed to render.'
        );

        return (
            <EmptyPane
                label="Custom tab render failed"
                message="The plugin React view threw while rendering."
            />
        );
    }
}

function CustomTabDynamicView({
    loader,
    onError,
    onLoaded
}: {
    loader: () => Promise<{ default: ComponentType } | ComponentType>;
    onError: (message: string) => void;
    onLoaded: () => void;
}) {
    const [LoadedView, setLoadedView] = useState<ComponentType | null>(null);

    useEffect(() => {
        let isMounted = true;
        void loader()
            .then((result) => {
                if (!isMounted) {
                    return;
                }

                const View =
                    typeof result === 'function' ? result : result.default;
                setLoadedView(() => View);
                onLoaded();
            })
            .catch((error: unknown) => {
                if (!isMounted) {
                    return;
                }

                onError(
                    error instanceof Error
                        ? error.message
                        : 'Custom dynamic tab failed to load.'
                );
            });

        return () => {
            isMounted = false;
        };
    }, [loader, onError, onLoaded]);

    if (!LoadedView) {
        return (
            <EmptyPane
                label="Loading custom tab"
                message="The plugin tab view is loading."
            />
        );
    }

    return (
        <Suspense
            fallback={
                <EmptyPane
                    label="Loading custom tab"
                    message="The plugin tab view is loading."
                />
            }
        >
            <div className="dt-custom-tab__react">
                <LoadedView />
            </div>
        </Suspense>
    );
}

function ComponentsPage({
    runtimeSnapshot,
    settingsSnapshot
}: {
    runtimeSnapshot: ClientRuntimeSnapshot;
    settingsSnapshot: ClientSettingsSnapshot;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedComponentId = searchParams.get('componentId');
    const selectedComponent =
        runtimeSnapshot.selectionStatus === 'none'
            ? undefined
            : ((requestedComponentId
                  ? findComponentTreeNode(
                        syntheticComponentTree,
                        requestedComponentId
                    )
                  : undefined) ??
              findComponentTreeNode(
                  syntheticComponentTree,
                  'component-group-0-child-0'
              ));
    const selectedComponentId = selectedComponent?.id;
    const hasEmptyRoot = runtimeSnapshot.rootStatus === 'empty';

    return (
        <section
            aria-label="Components page"
            className="dt-client-shell__page dt-client-shell__page--flush"
        >
            <div className="dt-client-filters">
                <label>
                    Tree filter
                    <input
                        onChange={(event) => {
                            setClientSetting('treeFilter', event.target.value);
                        }}
                        type="search"
                        value={settingsSnapshot.treeFilter}
                    />
                </label>
                <label>
                    State filter
                    <input
                        onChange={(event) => {
                            setClientSetting('stateFilter', event.target.value);
                        }}
                        type="search"
                        value={settingsSnapshot.stateFilter}
                    />
                </label>
            </div>
            <ResizableSplitPane
                left={
                    hasEmptyRoot ? (
                        <ComponentEmptyRootPane />
                    ) : (
                        <ComponentTreePlaceholder
                            onSelectedIdChange={(componentId) => {
                                setSearchParams({ componentId });
                            }}
                            selectedId={selectedComponentId}
                        />
                    )
                }
                leftLabel="Component tree"
                right={
                    hasEmptyRoot ? (
                        <ComponentEmptyRootDetailsPane />
                    ) : (
                        <ComponentDetailPlaceholder node={selectedComponent} />
                    )
                }
                rightLabel="Component details"
                storageKey="devtools.client.components.splitRatio"
            />
        </section>
    );
}

function ClientThemeBridge({
    theme
}: {
    theme: ClientSettingsSnapshot['theme'];
}) {
    const { setTheme } = useTheme();

    useEffect(() => {
        setTheme(theme);
    }, [setTheme, theme]);

    return null;
}

function ClientThemeToggle({
    theme
}: {
    theme: ClientSettingsSnapshot['theme'];
}) {
    return (
        <button
            aria-pressed={theme === 'dark'}
            className="dt-client-shell__command-button"
            onClick={() => {
                setClientSetting('theme', theme === 'dark' ? 'light' : 'dark');
            }}
            type="button"
        >
            {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
    );
}

function SettingsPage({
    settingsSnapshot
}: {
    settingsSnapshot: ClientSettingsSnapshot;
}) {
    const [importValue, setImportValue] = useState('');
    const [status, setStatus] = useState('Settings are stored locally.');

    return (
        <Card title="Settings">
            <section aria-label="Settings page" className="dt-settings-page">
                <div className="dt-settings-grid">
                    <label>
                        Theme
                        <select
                            onChange={(event) => {
                                setClientSetting(
                                    'theme',
                                    event.target.value === 'light'
                                        ? 'light'
                                        : 'dark'
                                );
                            }}
                            value={settingsSnapshot.theme}
                        >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </label>
                    <label>
                        Panel layout
                        <select
                            onChange={(event) => {
                                setClientSetting(
                                    'panelLayout',
                                    event.target.value === 'compact'
                                        ? 'compact'
                                        : 'comfortable'
                                );
                            }}
                            value={settingsSnapshot.panelLayout}
                        >
                            <option value="comfortable">Comfortable</option>
                            <option value="compact">Compact</option>
                        </select>
                    </label>
                    <label className="dt-settings-check">
                        <input
                            checked={settingsSnapshot.reduceMotion}
                            onChange={(event) => {
                                setClientSetting(
                                    'reduceMotion',
                                    event.target.checked
                                );
                            }}
                            type="checkbox"
                        />
                        Reduce motion
                    </label>
                    <label className="dt-settings-check">
                        <input
                            checked={settingsSnapshot.highPerformanceMode}
                            onChange={(event) => {
                                setClientSetting(
                                    'highPerformanceMode',
                                    event.target.checked
                                );
                            }}
                            type="checkbox"
                        />
                        High performance mode
                    </label>
                    <label className="dt-settings-check">
                        <input
                            checked={settingsSnapshot.timelineRecording}
                            onChange={(event) => {
                                setClientSetting(
                                    'timelineRecording',
                                    event.target.checked
                                );
                            }}
                            type="checkbox"
                        />
                        Timeline recording
                    </label>
                </div>
                <div className="dt-settings-grid">
                    <label>
                        Tree filter
                        <input
                            onChange={(event) => {
                                setClientSetting(
                                    'treeFilter',
                                    event.target.value
                                );
                            }}
                            type="search"
                            value={settingsSnapshot.treeFilter}
                        />
                    </label>
                    <label>
                        State filter
                        <input
                            onChange={(event) => {
                                setClientSetting(
                                    'stateFilter',
                                    event.target.value
                                );
                            }}
                            type="search"
                            value={settingsSnapshot.stateFilter}
                        />
                    </label>
                </div>
                <div className="dt-settings-actions">
                    <button
                        onClick={() => {
                            setImportValue(exportClientSettings());
                            setStatus('Settings exported.');
                        }}
                        type="button"
                    >
                        Export
                    </button>
                    <button
                        onClick={() => {
                            try {
                                importClientSettings(importValue);
                                setStatus('Settings imported.');
                            } catch (error) {
                                setStatus(
                                    error instanceof Error
                                        ? error.message
                                        : 'Settings import failed.'
                                );
                            }
                        }}
                        type="button"
                    >
                        Import
                    </button>
                    <button
                        onClick={() => {
                            resetClientSettings();
                            setImportValue('');
                            setStatus('Settings reset.');
                        }}
                        type="button"
                    >
                        Reset
                    </button>
                </div>
                <label>
                    Settings JSON
                    <textarea
                        onChange={(event) => {
                            setImportValue(event.target.value);
                        }}
                        value={importValue}
                    />
                </label>
                <p className="dt-settings-status" role="status">
                    {status}
                </p>
            </section>
        </Card>
    );
}

function RuntimeStatePage({
    state
}: {
    state: {
        description: string;
        label: string;
        title: string;
        tone: NotificationTone;
    };
}) {
    return (
        <Card title={state.title}>
            <section
                aria-label={state.label}
                className="dt-client-shell__page"
                data-runtime-state={state.label}
            >
                <p className="dt-client-shell__copy">{state.description}</p>
                <span
                    className={`dt-client-shell__badge dt-client-shell__badge--${state.tone}`}
                >
                    {state.label}
                </span>
            </section>
        </Card>
    );
}

function ComponentTreePlaceholder({
    onSelectedIdChange,
    selectedId
}: {
    onSelectedIdChange: (id: string) => void;
    selectedId?: string;
}) {
    return (
        <Card title="Component tree">
            <VirtualizedComponentTree
                initialSelectedId="component-group-0-child-0"
                nodes={syntheticComponentTree}
                onSelectedIdChange={onSelectedIdChange}
                selectedId={selectedId}
            />
        </Card>
    );
}

function ComponentEmptyRootPane() {
    return (
        <Card title="Component tree">
            <EmptyPane
                label="Empty React root"
                message="React is connected, but no mounted components were found in the current root."
            />
        </Card>
    );
}

function ComponentEmptyRootDetailsPane() {
    return (
        <Card title="Selected component">
            <EmptyPane
                label="No component selected"
                message="Select a component after the inspected app mounts React content."
            />
        </Card>
    );
}

function ComponentDetailPlaceholder({
    node
}: {
    node?: ReturnType<typeof findComponentTreeNode>;
}) {
    if (!node) {
        return (
            <Card title="Selected component">
                <EmptyPane
                    label="No component selected"
                    message="Choose a component from the tree to inspect its props, hooks, and state."
                />
            </Card>
        );
    }

    return (
        <Card title="Selected component">
            <div className="dt-components-detail">
                <dl className="dt-components-detail__summary">
                    <div>
                        <dt>Name</dt>
                        <dd>{node?.label ?? 'No component selected'}</dd>
                    </div>
                    <div>
                        <dt>Component id</dt>
                        <dd>{node?.id ?? 'None'}</dd>
                    </div>
                    <div>
                        <dt>Tags</dt>
                        <dd>{node?.tags?.join(', ') ?? 'None'}</dd>
                    </div>
                </dl>
                <StateViewer sections={node?.stateSections ?? []} />
            </div>
        </Card>
    );
}

function EmptyPane({ label, message }: { label: string; message: string }) {
    return (
        <div className="dt-empty-pane" role="status">
            <strong>{label}</strong>
            <p>{message}</p>
        </div>
    );
}

function formatOverviewValue(value: string): string {
    return value
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

type CustomTabRenderState =
    | {
          kind: 'dynamic';
          label: string;
          loader: () => Promise<{ default: ComponentType } | ComponentType>;
      }
    | {
          kind: 'empty';
          label: string;
      }
    | {
          kind: 'error';
          label: string;
          message: string;
      }
    | {
          kind: 'iframe';
          label: string;
          sandbox: string;
          src: string;
      }
    | {
          kind: 'react';
          label: string;
          view: ComponentType | ReactElement;
      };

function getCustomTabRenderState(tab: CustomTab): CustomTabRenderState {
    const iframeUrl =
        tab.iframeUrl ?? (typeof tab.view === 'string' ? tab.view : undefined);

    if (iframeUrl) {
        const validatedUrl = getValidatedCustomTabUrl(tab, iframeUrl);

        if (!validatedUrl) {
            return {
                kind: 'error',
                label: 'Blocked iframe',
                message:
                    'Only http, https, and same-origin custom tab iframe URLs are allowed.'
            };
        }

        return {
            kind: 'iframe',
            label: 'Iframe tab',
            sandbox: getCustomTabSandbox(tab),
            src: validatedUrl
        };
    }

    if (isDynamicCustomTabView(tab.view)) {
        return {
            kind: 'dynamic',
            label: 'Dynamic React tab',
            loader: tab.view.loader
        };
    }

    if (isComponentCustomTabView(tab.view)) {
        return {
            kind: 'react',
            label: 'React tab',
            view: tab.view.component
        };
    }

    if (isReactElement(tab.view)) {
        return {
            kind: 'react',
            label: 'React tab',
            view: tab.view
        };
    }

    if (typeof tab.view === 'function') {
        return {
            kind: 'react',
            label: 'React tab',
            view: tab.view as ComponentType
        };
    }

    return {
        kind: 'empty',
        label: 'Empty tab'
    };
}

function getValidatedCustomTabUrl(
    tab: CustomTab,
    iframeUrl: string
): string | null {
    const persistedUrl = tab.persist
        ? readCustomTabPersistedUrl(tab.name)
        : undefined;
    const rawUrl = persistedUrl ?? iframeUrl;

    try {
        const baseUrl =
            typeof window === 'undefined'
                ? 'http://localhost'
                : window.location.href;
        const url = new URL(rawUrl, baseUrl);

        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }

        const resolvedUrl = url.toString();

        if (tab.persist) {
            writeCustomTabPersistedUrl(tab.name, resolvedUrl);
        }

        return resolvedUrl;
    } catch {
        return null;
    }
}

function getCustomTabSandbox(tab: CustomTab): string {
    const requestedSandbox = tab.sandbox?.trim();

    if (!requestedSandbox) {
        return 'allow-forms allow-scripts allow-same-origin';
    }

    const allowedTokens = new Set([
        'allow-downloads',
        'allow-forms',
        'allow-modals',
        'allow-popups',
        'allow-same-origin',
        'allow-scripts'
    ]);

    return requestedSandbox
        .split(/\s+/)
        .filter((token) => allowedTokens.has(token))
        .join(' ');
}

function readCustomTabPersistedUrl(tabName: string): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return (
        window.localStorage.getItem(getCustomTabPersistedUrlKey(tabName)) ??
        undefined
    );
}

function writeCustomTabPersistedUrl(tabName: string, url: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(getCustomTabPersistedUrlKey(tabName), url);
}

function getCustomTabPersistedUrlKey(tabName: string): string {
    return `devtools.client.customTab.${tabName}.iframeUrl`;
}

function isComponentCustomTabView(
    view: unknown
): view is { component: ComponentType | ReactElement } {
    return Boolean(
        view &&
        typeof view === 'object' &&
        'component' in view &&
        (typeof view.component === 'function' || isReactElement(view.component))
    );
}

function isDynamicCustomTabView(view: unknown): view is {
    loader: () => Promise<{ default: ComponentType } | ComponentType>;
} {
    return Boolean(
        view &&
        typeof view === 'object' &&
        'loader' in view &&
        typeof view.loader === 'function'
    );
}

function isReactElement(value: unknown): value is ReactElement {
    return Boolean(
        value &&
        typeof value === 'object' &&
        '$$typeof' in value &&
        'props' in value
    );
}

function findInspectorNode(
    nodes: Array<CustomInspectorNode>,
    nodeId: string
): CustomInspectorNode | undefined {
    for (const node of nodes) {
        if (node.id === nodeId) {
            return node;
        }

        const childMatch = findInspectorNode(node.children ?? [], nodeId);

        if (childMatch) {
            return childMatch;
        }
    }

    return undefined;
}

function countInspectorNodes(nodes: Array<CustomInspectorNode>): number {
    return nodes.reduce(
        (count, node) => count + 1 + countInspectorNodes(node.children ?? []),
        0
    );
}

function filterInspectorState(
    state: InspectorState,
    filter: string
): InspectorState {
    const normalizedFilter = filter.trim().toLowerCase();

    if (!normalizedFilter) {
        return state;
    }

    return Object.fromEntries(
        Object.entries(state)
            .map(([category, entries]) => [
                category,
                entries.filter((entry) =>
                    [
                        category,
                        entry.key,
                        formatInspectorStateValue(entry.value)
                    ]
                        .join(' ')
                        .toLowerCase()
                        .includes(normalizedFilter)
                )
            ])
            .filter(([, entries]) => entries.length > 0)
    );
}

function toStateViewerSections(state: InspectorState): StateViewerSection[] {
    return Object.entries(state).map(([category, entries]) => ({
        fields: entries.map((entry, index) => ({
            editable: entry.editable,
            name: entry.key,
            path: [category, index, entry.key],
            value: toStateViewerValue(entry.value)
        })),
        name: category
    }));
}

function updateInspectorStateField(
    state: InspectorState,
    path: Array<number | string>,
    operation: StateViewerEditOperation
): InspectorState {
    const [category, index] = path;

    if (typeof category !== 'string' || typeof index !== 'number') {
        return state;
    }

    const entries = state[category];

    if (!entries?.[index]) {
        return state;
    }

    return {
        ...state,
        [category]:
            operation.type === 'remove'
                ? entries.filter((_, entryIndex) => entryIndex !== index)
                : entries.map((entry, entryIndex) =>
                      entryIndex === index
                          ? {
                                ...entry,
                                key: operation.newKey ?? entry.key,
                                value: fromStateViewerValue(operation.value)
                            }
                          : entry
                  )
    };
}

function fromStateViewerValue(value: StateViewerValue): unknown {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    const customValue = value._custom.value;

    if (customValue === undefined) {
        return value._custom.display;
    }

    return fromNestedStateViewerValue(customValue);
}

function fromNestedStateViewerValue(
    value: Exclude<StateViewerCustomValue['_custom']['value'], undefined>
): unknown {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => fromStateViewerValue(item));
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            fromStateViewerValue(item)
        ])
    );
}

function toStateViewerValue(
    value: InspectorStateEntry['value']
): StateViewerValue {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    return {
        _custom: {
            display: formatInspectorStateValue(value),
            preview:
                typeof value === 'object' ? JSON.stringify(value) : undefined,
            type: Array.isArray(value) ? 'array' : typeof value,
            value:
                typeof value === 'object' && value !== null
                    ? toNestedStateViewerValue(value)
                    : undefined
        }
    };
}

function toNestedStateViewerValue(
    value: object
): Exclude<StateViewerCustomValue['_custom']['value'], undefined> {
    if (Array.isArray(value)) {
        return value.map((item) => toStateViewerValue(item));
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            toStateViewerValue(item)
        ])
    );
}

function formatInspectorStateValue(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (
        value === null ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return String(value);
    }

    if (Array.isArray(value)) {
        return `Array(${value.length})`;
    }

    if (typeof value === 'object') {
        return 'Object';
    }

    return typeof value;
}

function getRuntimeBlock(snapshot: ClientRuntimeSnapshot): {
    description: string;
    label: string;
    title: string;
    tone: NotificationTone;
} | null {
    if (snapshot.connectionStatus === 'waiting') {
        return {
            description:
                'The devtools client is waiting for an inspected React runtime to connect.',
            label: 'waiting-for-connection',
            title: 'Waiting for connection',
            tone: 'info'
        };
    }

    if (snapshot.connectionStatus === 'disconnected') {
        return {
            description:
                'The inspected runtime disconnected. Reopen or refresh the inspected app to reconnect.',
            label: 'transport-disconnected',
            title: 'Runtime disconnected',
            tone: 'warning'
        };
    }

    if (snapshot.connectionStatus === 'reconnecting') {
        return {
            description:
                'The transport connection dropped and the devtools client is attempting to reconnect.',
            label: 'transport-reconnecting',
            title: 'Reconnecting',
            tone: 'info'
        };
    }

    if (snapshot.reactStatus === 'not-detected') {
        return {
            description:
                'The page is connected, but no React renderer has been detected yet.',
            label: 'no-react-detected',
            title: 'No React detected',
            tone: 'warning'
        };
    }

    if (snapshot.reactStatus === 'unsupported') {
        return {
            description: snapshot.unsupportedReactVersion
                ? `React ${snapshot.unsupportedReactVersion} is not supported by this devtools build.`
                : 'The connected React version is not supported by this devtools build.',
            label: 'unsupported-react-version',
            title: 'Unsupported React version',
            tone: 'danger'
        };
    }

    return null;
}

export function App({ initialEntries, router = 'memory' }: AppProps) {
    const children: ReactNode = <ClientShell />;

    if (router === 'none') {
        return (
            <MemoryRouter initialEntries={initialEntries}>
                {children}
            </MemoryRouter>
        );
    }

    return (
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    );
}
