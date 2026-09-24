import type { ReactNode } from 'react';
import {
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
import '@devtools/ui/style.css';
import './style.css';
import {
    getClientCommandSnapshot,
    getVisibleClientCommands,
    subscribeToClientCommands,
    type ClientCommand
} from './commands';
import { ResizableSplitPane } from './components/layout';
import { StateViewer } from './components/state';
import {
    VirtualizedComponentTree,
    findComponentTreeNode,
    generateSyntheticComponentTree
} from './components/tree';
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
