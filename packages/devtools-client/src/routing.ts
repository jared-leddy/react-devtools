import {
    ReactDevToolsContextHookKeys,
    createDevToolsContext,
    getCustomTabs,
    registerDevToolsPluginContext,
    type CustomInspectorOptions,
    type CustomTab
} from '@devtools/kit';

export type ClientRouteKind = 'customInspector' | 'customTab' | 'page';

export interface ClientRoute {
    id: string;
    kind: ClientRouteKind;
    label: string;
    path: string;
    summary: string;
}

export interface ClientRouteRegistrySnapshot {
    customInspectors: CustomInspectorOptions[];
    customTabs: CustomTab[];
}

type RouteListener = () => void;

export const BUILT_IN_ROUTES: ClientRoute[] = [
    {
        id: 'overview',
        kind: 'page',
        label: 'Overview',
        path: '/overview',
        summary: 'High-level runtime and connection overview.'
    },
    {
        id: 'components',
        kind: 'page',
        label: 'Components',
        path: '/components',
        summary: 'React component tree and selected state surface.'
    },
    {
        id: 'timeline',
        kind: 'page',
        label: 'Timeline',
        path: '/timeline',
        summary: 'Timeline route reserved for future profiling work.'
    },
    {
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
    customTabs: []
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

export function resetClientRouteRegistryForTests(): void {
    customInspectors.clear();
    listeners.clear();
    initialized = false;
    refreshRouteSnapshot();
}

export function toCustomInspectorRoute(
    inspector: CustomInspectorOptions
): ClientRoute {
    return {
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
        customTabs: getCustomTabs()
    };
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
