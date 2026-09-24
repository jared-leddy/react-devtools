import { extname, relative, resolve, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import type {
    ViteTransportChannel,
    ViteTransportPayload
} from './viteTransport.js';

export const VITE_GRAPH_RPC_GET_REQUEST = 'devtools:graph:get';
export const VITE_GRAPH_RPC_GET_RESPONSE = 'devtools:graph:get:response';
export const VITE_GRAPH_UPDATE_EVENT = 'devtools:graph:update';

export type ViteGraphModuleKind =
    'asset' | 'css' | 'html' | 'js' | 'json' | 'jsx' | 'other' | 'ts' | 'tsx';

export type ViteGraphTraversalDirection = 'both' | 'dependencies' | 'importers';

export interface ViteGraphModuleRecord {
    filePath?: string;
    id: string;
    importedIds: string[];
    importerIds: string[];
    isEntry: boolean;
    kind: ViteGraphModuleKind;
    relativePath?: string;
    url: string;
}

export interface ViteGraphEdgeRecord {
    from: string;
    kind: 'import';
    to: string;
}

export interface ViteGraphSnapshot {
    edges: ViteGraphEdgeRecord[];
    modules: ViteGraphModuleRecord[];
}

export interface ViteGraphGetRequest {
    depth?: number;
    direction?: ViteGraphTraversalDirection;
    requestId: string;
    rootId?: string;
    type: typeof VITE_GRAPH_RPC_GET_REQUEST;
}

export interface ViteGraphGetResponse {
    error?: string;
    graph?: ViteGraphSnapshot;
    requestId: string;
    type: typeof VITE_GRAPH_RPC_GET_RESPONSE;
}

export interface ViteGraphUpdateEvent {
    type: typeof VITE_GRAPH_UPDATE_EVENT;
}

export interface ViteGraphExplorerOptions {
    root?: string;
    updateDebounceMs?: number;
}

interface ViteModuleNodeLike {
    acceptedHmrDeps?: Set<ViteModuleNodeLike>;
    file?: string | null;
    id?: string | null;
    importedModules?: Set<ViteModuleNodeLike>;
    importers?: Set<ViteModuleNodeLike>;
    isEntry?: boolean;
    url?: string;
}

interface ViteModuleGraphLike {
    idToModuleMap?: Map<string, ViteModuleNodeLike>;
    urlToModuleMap?: Map<string, ViteModuleNodeLike>;
}

const DEFAULT_UPDATE_DEBOUNCE_MS = 80;
const assetExtensions = new Set([
    '.apng',
    '.avif',
    '.eot',
    '.gif',
    '.jpeg',
    '.jpg',
    '.mp3',
    '.mp4',
    '.ogg',
    '.otf',
    '.png',
    '.svg',
    '.ttf',
    '.wav',
    '.webm',
    '.webp',
    '.woff',
    '.woff2'
]);

export function getViteModuleGraphSnapshot(
    server: Pick<ViteDevServer, 'moduleGraph'>,
    options: ViteGraphExplorerOptions = {},
    request: Pick<ViteGraphGetRequest, 'depth' | 'direction' | 'rootId'> = {}
): ViteGraphSnapshot {
    const rootDir = resolve(options.root ?? process.cwd());
    const graph = server.moduleGraph as ViteModuleGraphLike | undefined;
    const modules = collectViteModules(graph);
    const selectedModules = request.rootId
        ? traverseViteModules(modules, request.rootId, request)
        : modules;
    const selectedModuleIds = new Set(
        selectedModules.map((moduleNode) => getModuleRecordId(moduleNode))
    );
    const normalizedModules = selectedModules
        .map((moduleNode) => normalizeViteModule(moduleNode, rootDir))
        .sort((first, second) => first.id.localeCompare(second.id));
    const edges = selectedModules
        .flatMap((moduleNode) => normalizeViteModuleEdges(moduleNode))
        .filter(
            (edge) =>
                selectedModuleIds.has(edge.from) &&
                selectedModuleIds.has(edge.to)
        )
        .sort(
            (first, second) =>
                first.from.localeCompare(second.from) ||
                first.to.localeCompare(second.to)
        );

    return {
        edges,
        modules: normalizedModules
    };
}

export function installViteGraphRpc(
    server: ViteDevServer,
    channel: ViteTransportChannel,
    options: ViteGraphExplorerOptions = {}
): void {
    channel.on((payload) => {
        handleViteGraphRpcPayload(channel, server, payload, options);
    });

    installGraphWatcher(server, channel, options);
}

export function handleViteGraphRpcPayload(
    channel: ViteTransportChannel,
    server: Pick<ViteDevServer, 'moduleGraph'>,
    payload: ViteTransportPayload,
    options: ViteGraphExplorerOptions = {}
): void {
    if (!isRecord(payload) || typeof payload.type !== 'string') {
        return;
    }

    if (payload.type !== VITE_GRAPH_RPC_GET_REQUEST) {
        return;
    }

    const request = payload as unknown as ViteGraphGetRequest;

    try {
        channel.post({
            graph: getViteModuleGraphSnapshot(server, options, request),
            requestId: request.requestId,
            type: VITE_GRAPH_RPC_GET_RESPONSE
        } satisfies ViteGraphGetResponse);
    } catch (error) {
        channel.post({
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to read Vite module graph.',
            requestId: request.requestId,
            type: VITE_GRAPH_RPC_GET_RESPONSE
        } satisfies ViteGraphGetResponse);
    }
}

export function classifyViteGraphModule(
    moduleId: string | undefined
): ViteGraphModuleKind {
    const [pathname] = (moduleId ?? '').split('?', 2);
    const extension = extname(pathname).toLowerCase();

    if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
        return 'js';
    }

    if (extension === '.jsx') {
        return 'jsx';
    }

    if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
        return 'ts';
    }

    if (extension === '.tsx') {
        return 'tsx';
    }

    if (extension === '.css') {
        return 'css';
    }

    if (extension === '.html') {
        return 'html';
    }

    if (extension === '.json') {
        return 'json';
    }

    if (assetExtensions.has(extension)) {
        return 'asset';
    }

    return 'other';
}

function collectViteModules(
    graph: ViteModuleGraphLike | undefined
): ViteModuleNodeLike[] {
    const modules = new Map<string, ViteModuleNodeLike>();

    graph?.idToModuleMap?.forEach((moduleNode) => {
        modules.set(getModuleRecordId(moduleNode), moduleNode);
    });
    graph?.urlToModuleMap?.forEach((moduleNode) => {
        modules.set(getModuleRecordId(moduleNode), moduleNode);
    });

    return Array.from(modules.values());
}

function traverseViteModules(
    modules: ViteModuleNodeLike[],
    rootId: string,
    request: Pick<ViteGraphGetRequest, 'depth' | 'direction'>
): ViteModuleNodeLike[] {
    const moduleById = new Map(
        modules.flatMap((moduleNode) =>
            getModuleLookupKeys(moduleNode).map(
                (key) => [key, moduleNode] as [string, ViteModuleNodeLike]
            )
        )
    );
    const rootModule = moduleById.get(rootId);

    if (!rootModule) {
        throw new Error(`Vite module "${rootId}" was not found.`);
    }

    const maxDepth = request.depth ?? Number.POSITIVE_INFINITY;
    const direction = request.direction ?? 'both';
    const queue: Array<{ depth: number; moduleNode: ViteModuleNodeLike }> = [
        { depth: 0, moduleNode: rootModule }
    ];
    const visited = new Map<string, ViteModuleNodeLike>();

    while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
            continue;
        }

        const moduleId = getModuleRecordId(current.moduleNode);

        if (visited.has(moduleId)) {
            continue;
        }

        visited.set(moduleId, current.moduleNode);

        if (current.depth >= maxDepth) {
            continue;
        }

        getTraversalNeighbors(current.moduleNode, direction).forEach(
            (moduleNode) => {
                queue.push({
                    depth: current.depth + 1,
                    moduleNode
                });
            }
        );
    }

    return Array.from(visited.values());
}

function getTraversalNeighbors(
    moduleNode: ViteModuleNodeLike,
    direction: ViteGraphTraversalDirection
): ViteModuleNodeLike[] {
    const neighbors: ViteModuleNodeLike[] = [];

    if (direction === 'dependencies' || direction === 'both') {
        neighbors.push(...Array.from(moduleNode.importedModules ?? []));
    }

    if (direction === 'importers' || direction === 'both') {
        neighbors.push(...Array.from(moduleNode.importers ?? []));
    }

    return neighbors;
}

function normalizeViteModule(
    moduleNode: ViteModuleNodeLike,
    rootDir: string
): ViteGraphModuleRecord {
    const id = getModuleRecordId(moduleNode);
    const filePath = moduleNode.file ?? undefined;
    const relativePath =
        filePath && isInsideRoot(rootDir, filePath)
            ? toPosixPath(relative(rootDir, filePath))
            : undefined;

    return {
        filePath,
        id,
        importedIds: Array.from(moduleNode.importedModules ?? [])
            .map(getModuleRecordId)
            .sort(),
        importerIds: Array.from(moduleNode.importers ?? [])
            .map(getModuleRecordId)
            .sort(),
        isEntry: moduleNode.isEntry ?? (moduleNode.importers?.size ?? 0) === 0,
        kind: classifyViteGraphModule(moduleNode.file ?? moduleNode.id ?? id),
        relativePath,
        url: moduleNode.url ?? id
    };
}

function normalizeViteModuleEdges(
    moduleNode: ViteModuleNodeLike
): ViteGraphEdgeRecord[] {
    const from = getModuleRecordId(moduleNode);

    return Array.from(moduleNode.importedModules ?? []).map(
        (importedModule) => ({
            from,
            kind: 'import',
            to: getModuleRecordId(importedModule)
        })
    );
}

function getModuleLookupKeys(moduleNode: ViteModuleNodeLike): string[] {
    return [
        moduleNode.id,
        moduleNode.url,
        moduleNode.file,
        getModuleRecordId(moduleNode)
    ]
        .filter((key): key is string => Boolean(key))
        .map(toPosixPath);
}

function getModuleRecordId(moduleNode: ViteModuleNodeLike): string {
    return toPosixPath(
        moduleNode.id ??
            moduleNode.url ??
            moduleNode.file ??
            '<anonymous-module>'
    );
}

function installGraphWatcher(
    server: ViteDevServer,
    channel: ViteTransportChannel,
    options: ViteGraphExplorerOptions
): void {
    let timeout: NodeJS.Timeout | undefined;
    const debounceMs = options.updateDebounceMs ?? DEFAULT_UPDATE_DEBOUNCE_MS;
    const notify = () => {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            channel.post({ type: VITE_GRAPH_UPDATE_EVENT });
        }, debounceMs);
    };

    server.watcher?.on('add', notify);
    server.watcher?.on('change', notify);
    server.watcher?.on('unlink', notify);
}

function isInsideRoot(rootDir: string, filePath: string): boolean {
    return filePath === rootDir || filePath.startsWith(`${rootDir}${sep}`);
}

function toPosixPath(path: string): string {
    return path.split(sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
