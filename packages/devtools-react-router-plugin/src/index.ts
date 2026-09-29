import { useEffect, useMemo, useRef } from 'react';
import {
    useLocation,
    useNavigate,
    type Location,
    type RouteObject
} from 'react-router';
import {
    setupDevToolsPlugin,
    type RouteMetadata,
    type RouteNodeAction,
    type RouteParams,
    type RouteSegmentType,
    type RouteSourceLocation,
    type RouterAdapter,
    type RouterAdapterSnapshot,
    type RouterCurrentRoute,
    type RouterRouteNode
} from '@devtools/api';

export interface ReactRouterAdapterOptions {
    getLocation: () => Pick<Location, 'hash' | 'pathname' | 'search' | 'state'>;
    id?: string;
    label?: string;
    navigate?: (to: string, options?: { replace?: boolean }) => void;
    routes: RouteObject[];
}

export interface UseReactRouterAdapterOptions {
    adapterId?: string;
    adapterLabel?: string;
    pluginId?: string;
    pluginLabel?: string;
    routes: RouteObject[];
}

export interface ReactRouterAdapterController {
    adapter: RouterAdapter;
    notifyRouteChange(): void;
}

type RouteHandle = {
    devtools?: {
        label?: string;
        metadata?: RouteMetadata;
        source?: RouteSourceLocation;
    };
    source?: RouteSourceLocation;
};

type RouteNodeBuildContext = {
    currentPathname: string;
    parentFullPath: string;
    parentId: null | string;
    parentPattern: string;
    route: RouteObject;
    routeIndex: number;
};

export function createReactRouterAdapter(
    options: ReactRouterAdapterOptions
): ReactRouterAdapterController {
    const listeners = new Set<() => void>();
    const getRouteTree = () =>
        createReactRouterRouteTree(options.routes, options.getLocation());
    const getCurrentRoute = () =>
        createReactRouterCurrentRoute(options.routes, options.getLocation());
    const adapter: RouterAdapter = {
        getCurrentRoute,
        getRouteTree,
        getSnapshot() {
            return {
                currentRoute: getCurrentRoute(),
                rootNodes: getRouteTree()
            } satisfies RouterAdapterSnapshot;
        },
        id: options.id ?? 'react-router',
        kind: 'react-router',
        label: options.label ?? 'React Router',
        navigate: options.navigate
            ? ({ replace, to }) => {
                  options.navigate?.(to, { replace });
              }
            : undefined,
        onRouteChange(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        openFile: undefined
    };

    return {
        adapter,
        notifyRouteChange() {
            listeners.forEach((listener) => {
                listener();
            });
        }
    };
}

export function useRegisterReactRouterAdapter({
    adapterId,
    adapterLabel,
    pluginId = 'react-router',
    pluginLabel = 'React Router',
    routes
}: UseReactRouterAdapterOptions): void {
    const location = useLocation();
    const navigate = useNavigate();
    const locationRef = useRef(location);
    const routesRef = useRef(routes);
    const navigateRef = useRef(navigate);
    const controller = useMemo(
        () =>
            createReactRouterAdapter({
                getLocation: () => locationRef.current,
                id: adapterId,
                label: adapterLabel,
                navigate: (to, options) => {
                    (
                        navigateRef.current as (
                            to: string,
                            options?: { replace?: boolean }
                        ) => void
                    )(to, options);
                },
                routes: routesRef.current
            }),
        [adapterId, adapterLabel]
    );

    useEffect(() => {
        locationRef.current = location;
        routesRef.current = routes;
        navigateRef.current = navigate;
        controller.notifyRouteChange();
    }, [controller, location, navigate, routes]);

    useEffect(() => {
        setupDevToolsPlugin(
            {
                id: pluginId,
                label: pluginLabel,
                packageName: '@devtools/react-router-plugin'
            },
            (api) => {
                api.registerRouterAdapter(controller.adapter);
            }
        );
    }, [controller, pluginId, pluginLabel]);
}

export function createReactRouterRouteTree(
    routes: RouteObject[],
    location: Pick<Location, 'pathname'>
): RouterRouteNode[] {
    return routes.map((route, routeIndex) =>
        createRouteNode({
            currentPathname: location.pathname,
            parentFullPath: '/',
            parentId: null,
            parentPattern: '/',
            route,
            routeIndex
        })
    );
}

export function createReactRouterCurrentRoute(
    routes: RouteObject[],
    location: Pick<Location, 'hash' | 'pathname' | 'search' | 'state'>
): RouterCurrentRoute {
    const matchedNodeIds = findMatchedRouteNodeIds(routes, location.pathname);

    return {
        fullPath: `${location.pathname}${location.search}${location.hash}`,
        hash: location.hash || undefined,
        matchedNodeIds,
        params: extractParamsFromRoutes(routes, location.pathname),
        pathname: location.pathname,
        query: parseSearchParams(location.search),
        search: location.search || undefined
    };
}

function createRouteNode({
    currentPathname,
    parentFullPath,
    parentId,
    parentPattern,
    route,
    routeIndex
}: RouteNodeBuildContext): RouterRouteNode {
    const routePath = getRoutePath(route);
    const fullPath = normalizeRoutePath(
        route.index ? parentFullPath : joinRoutePaths(parentFullPath, routePath)
    );
    const routeId =
        route.id ??
        createRouteNodeId({
            fullPath,
            parentId,
            routeIndex,
            routePath
        });
    const handle = getRouteHandle(route);
    const source = handle?.devtools?.source ?? handle?.source;
    const params = matchRoutePattern(fullPath, currentPathname)?.params;
    const isExact = Boolean(
        matchRoutePattern(fullPath, currentPathname)?.exact
    );
    const isActive = isExact || isRoutePatternPrefix(fullPath, currentPathname);
    const metadata = createRouteMetadata(route, handle);
    const node: RouterRouteNode = {
        actions: createRouteActions({
            currentParams: params ?? {},
            fullPath,
            source
        }),
        children: route.children?.map((childRoute, childIndex) =>
            createRouteNode({
                currentPathname,
                parentFullPath: fullPath,
                parentId: routeId,
                parentPattern: fullPath,
                route: childRoute,
                routeIndex: childIndex
            })
        ),
        fullPath,
        id: routeId,
        isActive,
        isExact,
        label: handle?.devtools?.label ?? createRouteLabel(route, fullPath),
        metadata,
        parentId,
        params,
        path: route.index ? '' : route.path,
        segmentType: getRouteSegmentType(route, parentPattern),
        source
    };

    return removeUndefinedNodeFields(node);
}

function createRouteActions({
    currentParams,
    fullPath,
    source
}: {
    currentParams: RouteParams;
    fullPath: string;
    source?: RouteSourceLocation;
}): RouteNodeAction[] {
    const actions: RouteNodeAction[] = [];

    if (source) {
        actions.push({ source, type: 'open-file' });
    }

    const navigationTarget = fillDynamicSegments(fullPath, currentParams);

    if (navigationTarget) {
        actions.push({ to: navigationTarget, type: 'navigate' });
    }

    return actions;
}

function createRouteMetadata(
    route: RouteObject,
    handle: RouteHandle | undefined
): RouteMetadata {
    return {
        ...(handle?.devtools?.metadata ?? {}),
        caseSensitive: Boolean(route.caseSensitive),
        hasAction: Boolean('action' in route && route.action),
        hasErrorBoundary: Boolean(
            ('ErrorBoundary' in route && route.ErrorBoundary) ||
            ('errorElement' in route && route.errorElement)
        ),
        hasLoader: Boolean('loader' in route && route.loader),
        index: Boolean(route.index),
        routeId: route.id ?? ''
    };
}

function createRouteLabel(route: RouteObject, fullPath: string): string {
    if (route.id) {
        return route.id;
    }

    if (route.index) {
        return 'Index route';
    }

    if (route.path) {
        return route.path;
    }

    return fullPath === '/' ? 'Root route' : 'Pathless route';
}

function createRouteNodeId({
    fullPath,
    parentId,
    routeIndex,
    routePath
}: {
    fullPath: string;
    parentId: null | string;
    routeIndex: number;
    routePath: string;
}): string {
    const base = routePath || fullPath || 'pathless';

    return `${parentId ?? 'root'}:${routeIndex}:${base}`;
}

function findMatchedRouteNodeIds(
    routes: RouteObject[],
    pathname: string
): string[] {
    const chain = findMatchedRouteChain(routes, pathname, '/', null);

    return chain.map((node) => node.id);
}

function findMatchedRouteChain(
    routes: RouteObject[],
    pathname: string,
    parentFullPath: string,
    parentId: null | string
): RouterRouteNode[] {
    for (const [routeIndex, route] of routes.entries()) {
        const node = createRouteNode({
            currentPathname: pathname,
            parentFullPath,
            parentId,
            parentPattern: parentFullPath,
            route,
            routeIndex
        });

        if (!node.isActive) {
            continue;
        }

        const childChain = route.children
            ? findMatchedRouteChain(
                  route.children,
                  pathname,
                  node.fullPath ?? parentFullPath,
                  node.id
              )
            : [];

        return [node, ...childChain];
    }

    return [];
}

function extractParamsFromRoutes(
    routes: RouteObject[],
    pathname: string
): RouteParams {
    const matchedNodes = findMatchedRouteChain(routes, pathname, '/', null);

    return matchedNodes.reduce<RouteParams>(
        (params, node) => ({ ...params, ...(node.params ?? {}) }),
        {}
    );
}

function fillDynamicSegments(
    fullPath: string,
    currentParams: RouteParams
): string | undefined {
    const segments = toSegments(fullPath);
    const filledSegments = segments.map((segment) => {
        if (!segment.startsWith(':')) {
            return segment;
        }

        const paramName = segment.replace(/^:/, '').replace(/\?$/, '');
        const paramValue = currentParams[paramName];

        return typeof paramValue === 'string' ? paramValue : undefined;
    });

    if (filledSegments.some((segment) => segment === undefined)) {
        return undefined;
    }

    return normalizeRoutePath(`/${filledSegments.join('/')}`);
}

function getRouteHandle(route: RouteObject): RouteHandle | undefined {
    const handle = 'handle' in route ? route.handle : undefined;

    return isRecord(handle) ? (handle as RouteHandle) : undefined;
}

function getRoutePath(route: RouteObject): string {
    if (route.index) {
        return '';
    }

    return route.path ?? '';
}

function getRouteSegmentType(
    route: RouteObject,
    parentPattern: string
): RouteSegmentType {
    if (route.index) {
        return 'index';
    }

    const routePath = route.path ?? '';

    if (!routePath) {
        return parentPattern === '/' ? 'layout' : 'pathless';
    }

    if (routePath === '*') {
        return 'catch-all';
    }

    if (routePath.startsWith(':')) {
        return 'dynamic';
    }

    return 'static';
}

function isRoutePatternPrefix(pattern: string, pathname: string): boolean {
    const match = matchRoutePattern(pattern, pathname);

    return Boolean(match && !match.exact);
}

function matchRoutePattern(
    pattern: string,
    pathname: string
): { exact: boolean; params: RouteParams } | undefined {
    const patternSegments = toSegments(pattern);
    const pathSegments = toSegments(pathname);
    const params: RouteParams = {};

    if (patternSegments.length > pathSegments.length) {
        return undefined;
    }

    for (const [index, patternSegment] of patternSegments.entries()) {
        const pathSegment = pathSegments[index];

        if (patternSegment === '*') {
            params['*'] = pathSegments.slice(index).join('/');

            return { exact: true, params };
        }

        if (patternSegment.startsWith(':')) {
            params[patternSegment.replace(/^:/, '').replace(/\?$/, '')] =
                pathSegment ?? '';
            continue;
        }

        if (patternSegment !== pathSegment) {
            return undefined;
        }
    }

    return {
        exact: patternSegments.length === pathSegments.length,
        params
    };
}

function joinRoutePaths(parentPath: string, childPath: string): string {
    if (childPath.startsWith('/')) {
        return childPath;
    }

    return normalizeRoutePath(`${parentPath}/${childPath}`);
}

function normalizeRoutePath(path: string): string {
    const normalized = path.replace(/\/+/g, '/');

    if (normalized.length > 1 && normalized.endsWith('/')) {
        return normalized.slice(0, -1);
    }

    return normalized || '/';
}

function parseSearchParams(search: string): RouteParams {
    return Array.from(
        new URLSearchParams(search).entries()
    ).reduce<RouteParams>(
        (query, [key, value]) => ({ ...query, [key]: value }),
        {}
    );
}

function removeUndefinedNodeFields(node: RouterRouteNode): RouterRouteNode {
    return {
        ...node,
        actions: node.actions?.length ? node.actions : undefined,
        children: node.children?.length ? node.children : undefined,
        metadata: Object.keys(node.metadata ?? {}).length
            ? node.metadata
            : undefined,
        params: Object.keys(node.params ?? {}).length ? node.params : undefined
    };
}

function toSegments(path: string): string[] {
    return normalizeRoutePath(path).split('/').filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object');
}
