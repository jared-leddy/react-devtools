import type { ReactNode } from 'react';
import { useMemo, useSyncExternalStore } from 'react';
import {
    MemoryRouter,
    NavLink,
    Navigate,
    Route,
    Routes,
    type MemoryRouterProps
} from 'react-router';
import { Card, ThemeProvider, type NotificationTone } from '@devtools/ui';
import '@devtools/ui/style.css';
import './style.css';
import { ResizableSplitPane } from './components/layout';
import {
    VirtualizedComponentTree,
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
                    <h1>React DevTools</h1>
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
    return (
        <section
            aria-label="Components page"
            className="dt-client-shell__page dt-client-shell__page--flush"
        >
            <ResizableSplitPane
                left={<ComponentTreePlaceholder />}
                leftLabel="Component tree"
                right={<ComponentDetailPlaceholder />}
                rightLabel="Component details"
                storageKey="devtools.client.components.splitRatio"
            />
        </section>
    );
}

function ComponentTreePlaceholder() {
    return (
        <Card title="Component tree">
            <VirtualizedComponentTree
                initialSelectedId="component-group-0-child-0"
                nodes={syntheticComponentTree}
            />
        </Card>
    );
}

function ComponentDetailPlaceholder() {
    return (
        <Card title="Selected component">
            <dl className="dt-components-detail">
                <div>
                    <dt>Name</dt>
                    <dd>DevToolsPanel</dd>
                </div>
                <div>
                    <dt>Props</dt>
                    <dd>Inspectable state will appear here.</dd>
                </div>
                <div>
                    <dt>Hooks</dt>
                    <dd>Hook values are reserved for the next panel pass.</dd>
                </div>
            </dl>
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
