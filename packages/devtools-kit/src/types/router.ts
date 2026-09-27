import type { SerializableValue } from './inspector.js';

export type MaybePromise<T> = Promise<T> | T;

export type RouterAdapterKind =
    'custom' | 'nextjs' | 'react-router' | (string & {});

export type RouteSegmentType =
    | 'catch-all'
    | 'dynamic'
    | 'group'
    | 'index'
    | 'layout'
    | 'not-found'
    | 'optional-catch-all'
    | 'pathless'
    | 'redirect'
    | 'static'
    | 'unknown'
    | (string & {});

export type RouteMetadata = Record<string, SerializableValue>;
export type RouteParams = Record<string, SerializableValue>;

export interface RouteSourceLocation {
    column?: number;
    file: string;
    line?: number;
}

export interface OpenRouteFileAction {
    label?: string;
    source: RouteSourceLocation;
    type: 'open-file';
}

export interface NavigateRouteAction {
    label?: string;
    replace?: boolean;
    to: string;
    type: 'navigate';
}

export interface CustomRouteNodeAction {
    label: string;
    payload?: SerializableValue;
    type: string & {};
}

export type RouteNodeAction =
    CustomRouteNodeAction | NavigateRouteAction | OpenRouteFileAction;

export interface RouterRouteNode<
    Metadata extends RouteMetadata = RouteMetadata
> {
    actions?: RouteNodeAction[];
    children?: Array<RouterRouteNode<Metadata>>;
    fullPath?: string;
    id: string;
    isActive?: boolean;
    isExact?: boolean;
    label: string;
    metadata?: Metadata;
    name?: string;
    parentId?: string | null;
    params?: RouteParams;
    path?: string;
    segmentType?: RouteSegmentType;
    source?: RouteSourceLocation;
}

export interface RouterCurrentRoute<
    Params extends RouteParams = RouteParams,
    Query extends RouteParams = RouteParams
> {
    fullPath: string;
    hash?: string;
    matchedNodeIds?: string[];
    name?: string;
    params?: Params;
    pathname: string;
    query?: Query;
    redirectedFrom?: string;
    search?: string;
}

export interface RouterAdapterSnapshot<
    Metadata extends RouteMetadata = RouteMetadata,
    Params extends RouteParams = RouteParams,
    Query extends RouteParams = RouteParams
> {
    currentRoute?: RouterCurrentRoute<Params, Query> | null;
    rootNodes: Array<RouterRouteNode<Metadata>>;
}

export interface RouterNavigateRequest {
    replace?: boolean;
    to: string;
}

export interface RouterOpenFileRequest {
    routeNodeId: string;
    source: RouteSourceLocation;
}

export interface RouterAdapter<
    Metadata extends RouteMetadata = RouteMetadata,
    Params extends RouteParams = RouteParams,
    Query extends RouteParams = RouteParams
> {
    getCurrentRoute?(): MaybePromise<RouterCurrentRoute<Params, Query> | null>;
    getRouteTree(): MaybePromise<Array<RouterRouteNode<Metadata>>>;
    getSnapshot?(): MaybePromise<
        RouterAdapterSnapshot<Metadata, Params, Query>
    >;
    id: string;
    kind: RouterAdapterKind;
    label: string;
    navigate?(request: RouterNavigateRequest): MaybePromise<void>;
    onRouteChange?(listener: () => void): () => void;
    openFile?(request: RouterOpenFileRequest): MaybePromise<void>;
}

export interface RegisteredRouterAdapter<
    Metadata extends RouteMetadata = RouteMetadata,
    Params extends RouteParams = RouteParams,
    Query extends RouteParams = RouteParams
> {
    adapter: RouterAdapter<Metadata, Params, Query>;
    pluginId: string;
    pluginLabel: string;
}
