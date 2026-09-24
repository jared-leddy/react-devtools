import {
    ReactDevToolsContextHookKeys,
    createDevToolsContext,
    getCustomTabs,
    registerDevToolsPluginContext,
    type CustomInspectorOptions,
    type CustomTab
} from '@devtools/kit';
import { registerClientCommandContext } from './commands';

export type ClientRouteKind = 'customInspector' | 'customTab' | 'page';
export type ClientRouteCategory =
    'core' | 'runtime' | 'vite' | 'integrations' | 'custom' | 'preferences';
export type ClientRouteCapability =
    'vite' | 'source-inspector' | 'react-router' | 'next' | 'nekuta';

export interface ClientRouteEnvironment {
    capabilities: ClientRouteCapability[];
    transport: 'extension' | 'iframe' | 'standalone' | 'vite';
}

export interface ClientRoute {
    category: ClientRouteCategory;
    id: string;
    kind: ClientRouteKind;
    label: string;
    path: string;
    requires?: ClientRouteCapability[];
    requiresAny?: ClientRouteCapability[];
    summary: string;
}

export interface ClientRouteRegistrySnapshot {
    customInspectors: CustomInspectorOptions[];
    customTabs: CustomTab[];
    environment: ClientRouteEnvironment;
}

type RouteListener = () => void;

const LAST_ROUTE_STORAGE_KEY = 'devtools.client.lastRoute';
const TAB_STATE_STORAGE_KEY = 'devtools.client.tabState';

const defaultEnvironment: ClientRouteEnvironment = {
    capabilities: [],
    transport: 'standalone'
};
let currentEnvironment = defaultEnvironment;

export const BUILT_IN_ROUTES: ClientRoute[] = [
    {
        category: 'core',
        id: 'overview',
        kind: 'page',
        label: 'Overview',
        path: '/overview',
        summary: 'High-level runtime and connection overview.'
    },
    {
        category: 'core',
        id: 'components',
        kind: 'page',
        label: 'Components',
        path: '/components',
        summary: 'React component tree and selected state surface.'
    },
    {
        category: 'integrations',
        id: 'pages-routes',
        kind: 'page',
        label: 'Pages/Routes',
        path: '/pages-routes',
        requiresAny: ['react-router', 'next', 'nekuta'],
        summary: 'Detected router pages and route records.'
    },
    {
        category: 'runtime',
        id: 'timeline',
        kind: 'page',
        label: 'Timeline',
        path: '/timeline',
        summary: 'Timeline route reserved for future profiling work.'
    },
    {
        category: 'vite',
        id: 'assets',
        kind: 'page',
        label: 'Assets',
        path: '/assets',
        requires: ['vite'],
        summary: 'Vite asset graph and module metadata.'
    },
    {
        category: 'vite',
        id: 'graph',
        kind: 'page',
        label: 'Graph',
        path: '/graph',
        requires: ['vite'],
        summary: 'Vite module graph and dependency edges.'
    },
    {
        category: 'vite',
        id: 'source-inspector',
        kind: 'page',
        label: 'Source Inspector',
        path: '/source-inspector',
        requires: ['vite', 'source-inspector'],
        summary: 'Source file inspector for Vite-connected projects.'
    },
    {
        category: 'integrations',
        id: 'react-router',
        kind: 'page',
        label: 'React Router',
        path: '/react-router',
        requires: ['react-router'],
        summary: 'React Router route tree and navigation state.'
    },
    {
        category: 'integrations',
        id: 'next',
        kind: 'page',
        label: 'Next.js',
        path: '/next',
        requires: ['next'],
        summary: 'Next.js routing, app segments, and runtime metadata.'
    },
    {
        category: 'integrations',
        id: 'nekuta',
        kind: 'page',
        label: 'Nekuta',
        path: '/nekuta',
        requires: ['nekuta'],
        summary: 'Nekuta router and store integration details.'
    },
    {
        category: 'preferences',
        id: 'settings',
        kind: 'page',
        label: 'Settings',
        path: '/settings',
        summary: 'Panel preferences and plugin settings.'
    }
];

const customInspectors = new Map<string, CustomInspectorOptions>();
const listeners = new Set<RouteListener>();
let currentSnapshot: ClientRouteRegistrySnapshot = {
    customInspectors: [],
    customTabs: [],
    environment: currentEnvironment
};
let initialized = false;

export function initializeClientRouteRegistry(): ClientRouteRegistrySnapshot {
    if (!initialized) {
        initialized = true;
        const context = createDevToolsContext({
            shouldBridgeHookEvents: false
        });

        context.hooks.hook(
            ReactDevToolsContextHookKeys.ADD_INSPECTOR,
            (payload) => {
                if (isCustomInspectorOptions(payload.inspector)) {
                    customInspectors.set(
                        payload.inspector.id,
                        payload.inspector
                    );
                    notifyRouteListeners();
                }
            }
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED,
            () => {
                notifyRouteListeners();
            }
        );
        registerClientCommandContext(context);
        registerDevToolsPluginContext({ context, hasRoot: true });
        refreshRouteSnapshot();
    }

    return getClientRouteSnapshot();
}

export function subscribeToClientRoutes(listener: RouteListener): () => void {
    listeners.add(listener);
    initializeClientRouteRegistry();

    return () => {
        listeners.delete(listener);
    };
}

export function getClientRouteSnapshot(): ClientRouteRegistrySnapshot {
    return currentSnapshot;
}

export function setClientRouteEnvironment(
    environment: Partial<ClientRouteEnvironment>
): void {
    currentEnvironment = normalizeEnvironment(environment);
    notifyRouteListeners();
}

export function getVisibleClientRoutes(
    snapshot: ClientRouteRegistrySnapshot = getClientRouteSnapshot()
): ClientRoute[] {
    return [
        ...BUILT_IN_ROUTES.filter((route) =>
            isRouteEnabled(route, snapshot.environment)
        ),
        ...snapshot.customInspectors.map(toCustomInspectorRoute),
        ...snapshot.customTabs.map(toCustomTabRoute)
    ];
}

export function getClientRouteCategories(
    routes: ClientRoute[]
): Array<{ category: ClientRouteCategory; routes: ClientRoute[] }> {
    return ROUTE_CATEGORY_ORDER.map((category) => ({
        category,
        routes: routes.filter((route) => route.category === category)
    })).filter((group) => group.routes.length > 0);
}

export function getPersistedLastClientRoutePath(routes: ClientRoute[]): string {
    const fallbackRoute = routes[0]?.path ?? '/overview';
    const persistedPath = readStorageValue(LAST_ROUTE_STORAGE_KEY);

    if (persistedPath && routes.some((route) => route.path === persistedPath)) {
        return persistedPath;
    }

    return fallbackRoute;
}

export function persistClientRouteVisit(
    route: ClientRoute,
    currentPath = route.path
): void {
    writeStorageValue(LAST_ROUTE_STORAGE_KEY, route.path);
    writeTabState(route.id, {
        lastVisitedAt: new Date().toISOString(),
        path: currentPath
    });
}

export function resetClientRouteRegistryForTests(): void {
    customInspectors.clear();
    listeners.clear();
    initialized = false;
    currentEnvironment = defaultEnvironment;
    refreshRouteSnapshot();
}

export function toCustomInspectorRoute(
    inspector: CustomInspectorOptions
): ClientRoute {
    return {
        category: 'custom',
        id: `custom-inspector:${inspector.id}`,
        kind: 'customInspector',
        label: inspector.label,
        path: `/custom-inspector-tab-view/${encodePathSegment(inspector.id)}`,
        summary: `Custom inspector registered for ${inspector.label}.`
    };
}

export function toCustomTabRoute(tab: CustomTab): ClientRoute {
    const name = tab.path ?? tab.name;

    return {
        category: normalizeCustomTabCategory(tab.category),
        id: `custom-tab:${tab.name}`,
        kind: 'customTab',
        label: tab.title,
        path: `/custom-tab-view/${encodePathSegment(name)}`,
        summary: `Custom tab registered for ${tab.title}.`
    };
}

function notifyRouteListeners(): void {
    refreshRouteSnapshot();
    listeners.forEach((listener) => listener());
}

function refreshRouteSnapshot(): void {
    currentSnapshot = {
        customInspectors: Array.from(customInspectors.values()),
        customTabs: getCustomTabs(),
        environment: currentEnvironment
    };
}

const ROUTE_CATEGORY_ORDER: ClientRouteCategory[] = [
    'core',
    'runtime',
    'vite',
    'integrations',
    'custom',
    'preferences'
];

function isRouteEnabled(
    route: ClientRoute,
    environment: ClientRouteEnvironment
): boolean {
    if (!route.requires?.length && !route.requiresAny?.length) {
        return true;
    }

    const hasRequiredCapabilities = (route.requires ?? []).every((capability) =>
        environment.capabilities.includes(capability)
    );
    const hasAnyRequiredCapability =
        !route.requiresAny?.length ||
        route.requiresAny.some((capability) =>
            environment.capabilities.includes(capability)
        );

    return hasRequiredCapabilities && hasAnyRequiredCapability;
}

function normalizeEnvironment(
    environment: Partial<ClientRouteEnvironment>
): ClientRouteEnvironment {
    const transport = environment.transport ?? currentEnvironment.transport;
    const capabilities = new Set<ClientRouteCapability>(
        environment.capabilities ?? currentEnvironment.capabilities
    );

    if (transport === 'vite') {
        capabilities.add('vite');
    } else {
        capabilities.delete('vite');
    }

    return {
        capabilities: Array.from(capabilities),
        transport
    };
}

function normalizeCustomTabCategory(
    category: string | undefined
): ClientRouteCategory {
    return isClientRouteCategory(category) ? category : 'custom';
}

function isClientRouteCategory(
    value: string | undefined
): value is ClientRouteCategory {
    return Boolean(value && (ROUTE_CATEGORY_ORDER as string[]).includes(value));
}

function readStorageValue(key: string): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.localStorage.getItem(key) ?? undefined;
}

function writeStorageValue(key: string, value: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(key, value);
}

function writeTabState(
    routeId: string,
    state: { lastVisitedAt: string; path: string }
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const existing = window.localStorage.getItem(TAB_STATE_STORAGE_KEY);
    const tabState = existing
        ? (JSON.parse(existing) as Record<string, unknown>)
        : {};
    tabState[routeId] = state;
    window.localStorage.setItem(
        TAB_STATE_STORAGE_KEY,
        JSON.stringify(tabState)
    );
}

function encodePathSegment(value: string): string {
    return encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));
}

function isCustomInspectorOptions(
    value: unknown
): value is CustomInspectorOptions {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'id' in value &&
        'label' in value &&
        typeof value.id === 'string' &&
        typeof value.label === 'string'
    );
}
