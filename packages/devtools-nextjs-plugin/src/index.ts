import { useEffect, useMemo, useRef } from 'react';
import {
    useParams,
    usePathname,
    useRouter as useAppRouter,
    useSearchParams,
    useSelectedLayoutSegments
} from 'next/navigation';
import { useRouter as usePagesRouter } from 'next/router';
import {
    setupDevToolsPlugin,
    type RouteMetadata,
    type RouteParams,
    type RouteSegmentType,
    type RouteSourceLocation,
    type RouterAdapter,
    type RouterAdapterSnapshot,
    type RouterCurrentRoute,
    type RouterRouteNode
} from '@devtools/api';

export type NextRouterMode = 'app' | 'pages';

export interface NextRouteDefinition {
    children?: NextRouteDefinition[];
    id?: string;
    label?: string;
    metadata?: RouteMetadata;
    mode?: NextRouterMode;
    path: string;
    source?: RouteSourceLocation;
}

export interface NextRouterLocation {
    hash?: string;
    pathname: string;
    query?: RouteParams;
    search?: string;
    segments?: string[];
}

export interface NextRouterAdapterOptions {
    getLocation: () => NextRouterLocation;
    id?: string;
    label?: string;
    mode?: NextRouterMode;
    navigate?: (to: string, options?: { replace?: boolean }) => void;
    routes: NextRouteDefinition[];
}

export interface UseNextRouterAdapterOptions {
    adapterId?: string;
    adapterLabel?: string;
    pluginId?: string;
    pluginLabel?: string;
    routes: NextRouteDefinition[];
}

export interface NextRouterAdapterController {
    adapter: RouterAdapter;
    notifyRouteChange(): void;
}

export interface NextManifests {
    appPathRoutesManifest?: Record<string, string>;
    pagesManifest?: Record<string, string>;
    routesManifest?: {
        dynamicRoutes?: Array<{ page: string; regex?: string }>;
        staticRoutes?: Array<{ page: string }>;
    };
}

type RouteNodeBuildContext = {
    currentPathname: string;
    mode?: NextRouterMode;
    parentFullPath: string;
    parentId: null | string;
    route: NextRouteDefinition;
    routeIndex: number;
};

export function createNextRouterAdapter(
    options: NextRouterAdapterOptions
): NextRouterAdapterController {
    const listeners = new Set<() => void>();
    const getRouteTree = () =>
        createNextRouteTree(options.routes, options.getLocation(), {
            mode: options.mode
        });
    const getCurrentRoute = () =>
        createNextCurrentRoute(options.routes, options.getLocation(), {
            mode: options.mode
        });
    const adapter: RouterAdapter = {
        getCurrentRoute,
        getRouteTree,
        getSnapshot() {
            return {
                currentRoute: getCurrentRoute(),
                rootNodes: getRouteTree()
            } satisfies RouterAdapterSnapshot;
        },
        id: options.id ?? `nextjs-${options.mode ?? 'router'}`,
        kind: 'nextjs',
        label: options.label ?? getAdapterLabel(options.mode),
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

export function useRegisterNextAppRouterAdapter({
    adapterId = 'nextjs-app-router',
    adapterLabel = 'Next.js App Router',
    pluginId = 'nextjs-router',
    pluginLabel = 'Next.js Router',
    routes
}: UseNextRouterAdapterOptions): void {
    const pathname = usePathname() ?? '/';
    const searchParams = useSearchParams();
    const params = useParams();
    const segments = useSelectedLayoutSegments() ?? [];
    const router = useAppRouter();
    const locationRef = useRef<NextRouterLocation>({
        pathname,
        query: toRouteParams(params),
        search: createSearch(searchParams),
        segments
    });
    const routesRef = useRef(routes);
    const routerRef = useRef(router);
    const controller = useMemo(
        () =>
            createNextRouterAdapter({
                getLocation: () => locationRef.current,
                id: adapterId,
                label: adapterLabel,
                mode: 'app',
                navigate: (to, options) => {
                    if (options?.replace) {
                        routerRef.current.replace(to);
                        return;
                    }

                    routerRef.current.push(to);
                },
                routes: routesRef.current
            }),
        [adapterId, adapterLabel]
    );

    useEffect(() => {
        locationRef.current = {
            pathname,
            query: toRouteParams(params),
            search: createSearch(searchParams),
            segments
        };
        routesRef.current = routes;
        routerRef.current = router;
        controller.notifyRouteChange();
    }, [controller, params, pathname, router, routes, searchParams, segments]);

    useEffect(() => {
        setupDevToolsPlugin(
            {
                id: pluginId,
                label: pluginLabel,
                packageName: '@devtools/nextjs-plugin'
            },
            (api) => {
                api.registerRouterAdapter(controller.adapter);
            }
        );
    }, [controller, pluginId, pluginLabel]);
}

export function useRegisterNextPagesRouterAdapter({
    adapterId = 'nextjs-pages-router',
    adapterLabel = 'Next.js Pages Router',
    pluginId = 'nextjs-router',
    pluginLabel = 'Next.js Router',
    routes
}: UseNextRouterAdapterOptions): void {
    const router = usePagesRouter();
    const routerRef = useRef(router);
    const routesRef = useRef(routes);
    const locationRef = useRef<NextRouterLocation>(
        createPagesRouterLocation(router)
    );
    const controller = useMemo(
        () =>
            createNextRouterAdapter({
                getLocation: () => locationRef.current,
                id: adapterId,
                label: adapterLabel,
                mode: 'pages',
                navigate: (to, options) => {
                    if (options?.replace) {
                        void routerRef.current.replace(to);
                        return;
                    }

                    void routerRef.current.push(to);
                },
                routes: routesRef.current
            }),
        [adapterId, adapterLabel]
    );

    useEffect(() => {
        locationRef.current = createPagesRouterLocation(router);
        routesRef.current = routes;
        routerRef.current = router;
        controller.notifyRouteChange();
    }, [controller, router, routes]);

    useEffect(() => {
        setupDevToolsPlugin(
            {
                id: pluginId,
                label: pluginLabel,
                packageName: '@devtools/nextjs-plugin'
            },
            (api) => {
                api.registerRouterAdapter(controller.adapter);
            }
        );
    }, [controller, pluginId, pluginLabel]);
}

export function createNextRouteTree(
    routes: NextRouteDefinition[],
    location: Pick<NextRouterLocation, 'pathname'>,
    options: { mode?: NextRouterMode } = {}
): RouterRouteNode[] {
    return routes
        .filter((route) => !options.mode || route.mode === options.mode)
        .map((route, routeIndex) =>
            createRouteNode({
                currentPathname: location.pathname,
                mode: options.mode,
                parentFullPath: '/',
                parentId: null,
                route,
                routeIndex
            })
        );
}

export function createNextCurrentRoute(
    routes: NextRouteDefinition[],
    location: NextRouterLocation,
    options: { mode?: NextRouterMode } = {}
): RouterCurrentRoute {
    const matchedNodes = findMatchedRouteChain(
        routes.filter((route) => !options.mode || route.mode === options.mode),
        location.pathname,
        '/',
        null,
        options.mode
    );
    const matchedParams = matchedNodes.reduce<RouteParams>(
        (params, node) => ({ ...params, ...(node.params ?? {}) }),
        {}
    );
    const query = {
        ...parseSearchParams(location.search ?? ''),
        ...(location.query ?? {})
    };

    return {
        fullPath: `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`,
        hash: location.hash,
        matchedNodeIds: matchedNodes.map((node) => node.id),
        params: { ...matchedParams, ...(location.query ?? {}) },
        pathname: location.pathname,
        query,
        search: location.search
    };
}

export function createNextRoutesFromManifests(
    manifests: NextManifests
): NextRouteDefinition[] {
    const routes = new Map<string, NextRouteDefinition>();

    Object.entries(manifests.appPathRoutesManifest ?? {}).forEach(
        ([filePath, routePath]) => {
            routes.set(`app:${routePath}`, {
                id: `app:${routePath}`,
                label: createRouteLabel(routePath),
                metadata: { manifest: 'app-path-routes-manifest' },
                mode: 'app',
                path: routePath,
                source: {
                    file: filePath
                }
            });
        }
    );

    Object.entries(manifests.pagesManifest ?? {}).forEach(
        ([pagePath, filePath]) => {
            if (pagePath.startsWith('/_')) {
                return;
            }

            routes.set(`pages:${pagePath}`, {
                id: `pages:${pagePath}`,
                label: createRouteLabel(pagePath),
                metadata: { manifest: 'pages-manifest' },
                mode: 'pages',
                path: pagePath,
                source: {
                    file: filePath
                }
            });
        }
    );

    for (const route of manifests.routesManifest?.staticRoutes ?? []) {
        const key = `pages:${route.page}`;
        routes.set(key, {
            ...routes.get(key),
            id: key,
            label: createRouteLabel(route.page),
            metadata: {
                ...(routes.get(key)?.metadata ?? {}),
                routeManifestKind: 'static'
            },
            mode: 'pages',
            path: route.page
        });
    }

    for (const route of manifests.routesManifest?.dynamicRoutes ?? []) {
        const key = `pages:${route.page}`;
        routes.set(key, {
            ...routes.get(key),
            id: key,
            label: createRouteLabel(route.page),
            metadata: {
                ...(routes.get(key)?.metadata ?? {}),
                regex: route.regex ?? '',
                routeManifestKind: 'dynamic'
            },
            mode: 'pages',
            path: route.page
        });
    }

    return Array.from(routes.values()).sort((route, nextRoute) =>
        route.path.localeCompare(nextRoute.path)
    );
}

function createRouteNode({
    currentPathname,
    mode,
    parentFullPath,
    parentId,
    route,
    routeIndex
}: RouteNodeBuildContext): RouterRouteNode {
    const fullPath = normalizeRoutePath(
        joinRoutePaths(parentFullPath, route.path)
    );
    const routeId =
        route.id ??
        `${mode ?? route.mode ?? 'nextjs'}:${parentId ?? 'root'}:${routeIndex}:${fullPath}`;
    const match =
        fullPath === '/' && currentPathname !== '/' && !route.children?.length
            ? undefined
            : matchNextRoutePath(fullPath, currentPathname);
    const node: RouterRouteNode = {
        actions: createRouteActions(route, fullPath, match?.params ?? {}),
        children: route.children?.map((child, childIndex) =>
            createRouteNode({
                currentPathname,
                mode,
                parentFullPath: fullPath,
                parentId: routeId,
                route: child,
                routeIndex: childIndex
            })
        ),
        fullPath,
        id: routeId,
        isActive: Boolean(match),
        isExact: Boolean(match?.exact),
        label: route.label ?? createRouteLabel(fullPath),
        metadata: {
            ...(route.metadata ?? {}),
            mode: route.mode ?? mode ?? 'app'
        },
        parentId,
        params: match?.params,
        path: route.path,
        segmentType: getRouteSegmentType(route.path),
        source: route.source
    };

    if (!node.children?.length) {
        delete node.children;
    }

    return node;
}

function createRouteActions(
    route: NextRouteDefinition,
    fullPath: string,
    currentParams: RouteParams
) {
    const actions = [];
    const navigablePath = fillDynamicSegments(fullPath, currentParams);

    if (route.source) {
        actions.push({
            label: 'Open file',
            source: route.source,
            type: 'open-file' as const
        });
    }

    if (navigablePath) {
        actions.push({
            label: 'Navigate',
            to: navigablePath,
            type: 'navigate' as const
        });
    }

    return actions;
}

function findMatchedRouteChain(
    routes: NextRouteDefinition[],
    pathname: string,
    parentFullPath: string,
    parentId: null | string,
    mode?: NextRouterMode
): RouterRouteNode[] {
    for (const [routeIndex, route] of routes.entries()) {
        const node = createRouteNode({
            currentPathname: pathname,
            mode,
            parentFullPath,
            parentId,
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
                  node.id,
                  mode
              )
            : [];

        return [node, ...childChain];
    }

    return [];
}

function matchNextRoutePath(
    routePath: string,
    pathname: string
): { exact: boolean; params: RouteParams } | undefined {
    const routeSegments = toSegments(routePath);
    const pathSegments = toSegments(pathname);
    const params: RouteParams = {};

    if (routeSegments.length > pathSegments.length) {
        return undefined;
    }

    for (const [index, routeSegment] of routeSegments.entries()) {
        const pathSegment = pathSegments[index];

        if (routeSegment === '...') {
            params['...'] = pathSegments.slice(index).join('/');
            return { exact: true, params };
        }

        if (isCatchAllSegment(routeSegment)) {
            const paramName = routeSegment
                .replace(/^\[\[?\.\.\./, '')
                .replace(/\]?\]$/, '');
            params[paramName] = pathSegments.slice(index).join('/');
            return { exact: true, params };
        }

        if (isDynamicSegment(routeSegment)) {
            params[routeSegment.slice(1, -1)] = pathSegment ?? '';
            continue;
        }

        if (routeSegment !== pathSegment) {
            return undefined;
        }
    }

    return {
        exact: routeSegments.length === pathSegments.length,
        params
    };
}

function fillDynamicSegments(
    routePath: string,
    currentParams: RouteParams
): string | undefined {
    const segments = toSegments(routePath);
    const filledSegments = segments.map((segment) => {
        if (isCatchAllSegment(segment)) {
            const paramName = segment
                .replace(/^\[\[?\.\.\./, '')
                .replace(/\]?\]$/, '');
            const paramValue = currentParams[paramName];

            return typeof paramValue === 'string' ? paramValue : undefined;
        }

        if (isDynamicSegment(segment)) {
            const paramValue = currentParams[segment.slice(1, -1)];

            return typeof paramValue === 'string' ? paramValue : undefined;
        }

        return segment;
    });

    if (filledSegments.some((segment) => segment === undefined)) {
        return undefined;
    }

    return normalizeRoutePath(`/${filledSegments.join('/')}`);
}

function getRouteSegmentType(path: string): RouteSegmentType {
    const segments = toSegments(path);
    const lastSegment = segments[segments.length - 1] ?? '';

    if (lastSegment.startsWith('(') && lastSegment.endsWith(')')) {
        return 'group';
    }

    if (lastSegment.startsWith('[[...')) {
        return 'optional-catch-all';
    }

    if (lastSegment.startsWith('[...')) {
        return 'catch-all';
    }

    if (lastSegment.startsWith('[') && lastSegment.endsWith(']')) {
        return 'dynamic';
    }

    if (path === '/') {
        return 'index';
    }

    return 'static';
}

function createPagesRouterLocation(router: {
    asPath?: string;
    pathname?: string;
    query?: Record<string, unknown>;
    route?: string;
}): NextRouterLocation {
    const [pathnameWithSearch, hashPart] = (
        router.asPath ??
        router.pathname ??
        router.route ??
        '/'
    ).split('#');
    const [pathname, searchPart] = pathnameWithSearch.split('?');

    return {
        hash: hashPart ? `#${hashPart}` : undefined,
        pathname: pathname || '/',
        query: toRouteParams(router.query ?? {}),
        search: searchPart ? `?${searchPart}` : undefined
    };
}

function createSearch(
    searchParams: URLSearchParams | null
): string | undefined {
    const search = searchParams?.toString() ?? '';

    return search ? `?${search}` : undefined;
}

function toRouteParams(value: unknown): RouteParams {
    if (!isRecord(value)) {
        return {};
    }

    return Object.entries(value).reduce<RouteParams>((params, [key, item]) => {
        if (
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        ) {
            return { ...params, [key]: item };
        }

        if (Array.isArray(item)) {
            return { ...params, [key]: item.join('/') };
        }

        return params;
    }, {});
}

function parseSearchParams(search: string): RouteParams {
    return Array.from(
        new URLSearchParams(search).entries()
    ).reduce<RouteParams>(
        (query, [key, value]) => ({ ...query, [key]: value }),
        {}
    );
}

function createRouteLabel(path: string): string {
    if (path === '/') {
        return 'Home';
    }

    return toSegments(path)
        .filter((segment) => !segment.startsWith('('))
        .map((segment) =>
            segment
                .replace(/^\[\[?\.\.\./, '')
                .replace(/\]?\]$/, '')
                .replace(/^\[/, '')
                .replace(/\]$/, '')
        )
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' / ');
}

function getAdapterLabel(mode?: NextRouterMode): string {
    if (mode === 'app') {
        return 'Next.js App Router';
    }

    if (mode === 'pages') {
        return 'Next.js Pages Router';
    }

    return 'Next.js Router';
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

function toSegments(path: string): string[] {
    return path.split('/').filter(Boolean);
}

function isCatchAllSegment(segment: string): boolean {
    return segment.startsWith('[...') || segment.startsWith('[[...');
}

function isDynamicSegment(segment: string): boolean {
    return segment.startsWith('[') && segment.endsWith(']');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
