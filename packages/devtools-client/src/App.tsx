import type { ReactNode } from 'react';
import { useMemo, useSyncExternalStore } from 'react';
import {
    MemoryRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
    useSearchParams,
    type MemoryRouterProps
} from 'react-router';
import {
    Card,
    ThemeProvider,
    ThemeToggle,
    type NotificationTone
} from '@devtools/ui';
import '@devtools/ui/style.css';
import './style.css';
import { ResizableSplitPane } from './components/layout';
import { StateViewer } from './components/state';
import {
    VirtualizedComponentTree,
    findComponentTreeNode,
    generateSyntheticComponentTree
} from './components/tree';
import {
    BUILT_IN_ROUTES,
    initializeClientRouteRegistry,
    subscribeToClientRoutes,
    toCustomInspectorRoute,
    toCustomTabRoute,
    type ClientRoute
} from './routing';

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
    const routeSnapshot = useSyncExternalStore(
        subscribeToClientRoutes,
        initializeClientRouteRegistry,
        initializeClientRouteRegistry
    );
    const routes = useMemo(
        () => [
            ...BUILT_IN_ROUTES,
            ...routeSnapshot.customInspectors.map(toCustomInspectorRoute),
            ...routeSnapshot.customTabs.map(toCustomTabRoute)
        ],
        [routeSnapshot]
    );

    return (
        <ThemeProvider>
            <main
                className="dt-client-shell"
                aria-label="React DevTools client"
            >
                <header className="dt-client-shell__header">
                    <div className="dt-client-shell__masthead">
                        <h1>React DevTools</h1>
                        <ThemeToggle />
                    </div>
                    <nav
                        className="dt-client-shell__nav"
                        aria-label="Panel tabs"
                    >
                        {routes.map((route) => (
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
                    </nav>
                </header>

                <Routes>
                    <Route
                        path="/"
                        element={<Navigate to="/overview" replace />}
                    />
                    {routes.map((route) => (
                        <Route
                            element={<RoutePage route={route} />}
                            key={route.id}
                            path={route.path}
                        />
                    ))}
                    <Route
                        path="*"
                        element={
                            <RoutePage
                                route={{
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
            </main>
        </ThemeProvider>
    );
}

function RoutePage({ route }: { route: ClientRoute }) {
    if (route.id === 'components') {
        return <ComponentsPage />;
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

function ComponentsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedComponentId = searchParams.get('componentId');
    const selectedComponent =
        (requestedComponentId
            ? findComponentTreeNode(
                  syntheticComponentTree,
                  requestedComponentId
              )
            : undefined) ??
        findComponentTreeNode(
            syntheticComponentTree,
            'component-group-0-child-0'
        );
    const selectedComponentId = selectedComponent?.id;

    return (
        <section
            aria-label="Components page"
            className="dt-client-shell__page dt-client-shell__page--flush"
        >
            <ResizableSplitPane
                left={
                    <ComponentTreePlaceholder
                        onSelectedIdChange={(componentId) => {
                            setSearchParams({ componentId });
                        }}
                        selectedId={selectedComponentId}
                    />
                }
                leftLabel="Component tree"
                right={<ComponentDetailPlaceholder node={selectedComponent} />}
                rightLabel="Component details"
                storageKey="devtools.client.components.splitRatio"
            />
        </section>
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

function ComponentDetailPlaceholder({
    node
}: {
    node?: ReturnType<typeof findComponentTreeNode>;
}) {
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
