import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@devtools/ui';
import {
    connectViteClientContext,
    getViteClientContext,
    type ViteHotContextLike
} from '@devtools/kit';

const VITE_TRANSPORT_EVENT = 'react-devtools:vite-transport-message';
const VITE_GRAPH_RPC_GET_REQUEST = 'devtools:graph:get';
const VITE_GRAPH_RPC_GET_RESPONSE = 'devtools:graph:get:response';
const VITE_GRAPH_UPDATE_EVENT = 'devtools:graph:update';
const GRAPH_RENDER_LIMIT = 180;
const GRAPH_WIDTH = 960;
const GRAPH_HEIGHT = 540;

export type ClientGraphModuleKind =
    'asset' | 'css' | 'html' | 'js' | 'json' | 'jsx' | 'other' | 'ts' | 'tsx';

export interface ClientGraphModuleRecord {
    filePath?: string;
    id: string;
    importedIds: string[];
    importerIds: string[];
    isEntry: boolean;
    kind: ClientGraphModuleKind;
    relativePath?: string;
    url: string;
}

export interface ClientGraphEdgeRecord {
    from: string;
    kind: 'import';
    to: string;
}

export interface ClientGraphSnapshot {
    edges: ClientGraphEdgeRecord[];
    modules: ClientGraphModuleRecord[];
}

type GraphLoadState = 'idle' | 'loading' | 'ready' | 'error';
type GraphPayload = Record<string, unknown>;
type GraphSelectionMode = 'all' | 'dependencies' | 'importers';

interface GraphTransport {
    off: (handler: (payload: GraphPayload) => void) => void;
    on: (handler: (payload: GraphPayload) => void) => void;
    post: (payload: GraphPayload) => void;
}

interface GraphLayoutNode {
    module: ClientGraphModuleRecord;
    x: number;
    y: number;
}

interface GraphLayout {
    edges: ClientGraphEdgeRecord[];
    nodes: GraphLayoutNode[];
}

let requestSequence = 0;

export function GraphPage() {
    const [graph, setGraph] = useState<ClientGraphSnapshot>({
        edges: [],
        modules: []
    });
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [query, setQuery] = useState('');
    const [kindFilter, setKindFilter] = useState<ClientGraphModuleKind | 'all'>(
        'all'
    );
    const [selectionMode, setSelectionMode] =
        useState<GraphSelectionMode>('all');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [loadState, setLoadState] = useState<GraphLoadState>('idle');
    const [loadError, setLoadError] = useState<string | undefined>();
    const [openStatus, setOpenStatus] = useState<string | undefined>();
    const transportRef = useRef<GraphTransport | null>(null);

    const moduleById = useMemo(
        () =>
            new Map(
                graph.modules.map((moduleNode) => [moduleNode.id, moduleNode])
            ),
        [graph.modules]
    );
    const selectedModule = selectedId ? moduleById.get(selectedId) : undefined;
    const visibleGraph = useMemo(
        () =>
            getVisibleGraph({
                graph,
                kindFilter,
                query,
                selectedId,
                selectionMode
            }),
        [graph, kindFilter, query, selectedId, selectionMode]
    );
    const graphLayout = useMemo(
        () => layoutGraph(visibleGraph),
        [visibleGraph]
    );

    useEffect(() => {
        let disposed = false;
        let cleanup: (() => void) | undefined;

        async function connectAndLoad() {
            setLoadState('loading');
            setLoadError(undefined);

            try {
                const transport = await createGraphTransport();

                if (disposed) {
                    return;
                }

                transportRef.current = transport;
                const handlePayload = (payload: GraphPayload) => {
                    if (payload.type === VITE_GRAPH_UPDATE_EVENT) {
                        requestGraph(transport);
                        return;
                    }

                    if (payload.type !== VITE_GRAPH_RPC_GET_RESPONSE) {
                        return;
                    }

                    if (typeof payload.error === 'string') {
                        setLoadState('error');
                        setLoadError(payload.error);
                        return;
                    }

                    const nextGraph = isClientGraphSnapshot(payload.graph)
                        ? payload.graph
                        : { edges: [], modules: [] };
                    setGraph(nextGraph);
                    setSelectedId((currentId) =>
                        currentId &&
                        nextGraph.modules.some(
                            (moduleNode) => moduleNode.id === currentId
                        )
                            ? currentId
                            : nextGraph.modules[0]?.id
                    );
                    setLoadState('ready');
                };

                transport.on(handlePayload);
                cleanup = () => {
                    transport.off(handlePayload);
                };
                requestGraph(transport);
            } catch (error) {
                if (!disposed) {
                    setLoadState('error');
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to connect to the Vite module graph.'
                    );
                }
            }
        }

        void connectAndLoad();

        return () => {
            disposed = true;
            cleanup?.();
        };
    }, []);

    async function openSelectedModule() {
        if (!selectedModule?.filePath) {
            return;
        }

        setOpenStatus('Opening editor');

        try {
            const response = await fetch(
                `/__open-in-editor?file=${encodeURI(selectedModule.filePath)}`
            );
            setOpenStatus(
                response.ok ? 'Editor request sent' : 'Editor unavailable'
            );
        } catch {
            setOpenStatus('Editor unavailable');
        }
    }

    return (
        <section
            aria-label="Graph page"
            className="dt-client-shell__page dt-graph-page"
        >
            <Card title="Graph">
                <div className="dt-graph-toolbar">
                    <label>
                        Search
                        <input
                            aria-label="Search modules"
                            onChange={(event) => {
                                setQuery(event.target.value);
                            }}
                            placeholder="src/App"
                            type="search"
                            value={query}
                        />
                    </label>
                    <label>
                        Type
                        <select
                            aria-label="Filter modules by type"
                            onChange={(event) => {
                                setKindFilter(
                                    event.target.value as
                                        ClientGraphModuleKind | 'all'
                                );
                            }}
                            value={kindFilter}
                        >
                            <option value="all">All modules</option>
                            {graphKinds.map((kind) => (
                                <option key={kind} value={kind}>
                                    {formatGraphKind(kind)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div
                        aria-label="Graph relationship focus"
                        className="dt-graph-toggle"
                    >
                        {graphSelectionModes.map((mode) => (
                            <button
                                aria-pressed={selectionMode === mode}
                                key={mode}
                                onClick={() => {
                                    setSelectionMode(mode);
                                }}
                                type="button"
                            >
                                {formatSelectionMode(mode)}
                            </button>
                        ))}
                    </div>
                    <div
                        aria-label="Graph zoom controls"
                        className="dt-graph-toggle"
                    >
                        <button
                            onClick={() => {
                                setZoom((currentZoom) =>
                                    Math.max(0.6, currentZoom - 0.2)
                                );
                            }}
                            type="button"
                        >
                            -
                        </button>
                        <button
                            onClick={() => {
                                setZoom(1);
                                setPan({ x: 0, y: 0 });
                            }}
                            type="button"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => {
                                setZoom((currentZoom) =>
                                    Math.min(1.8, currentZoom + 0.2)
                                );
                            }}
                            type="button"
                        >
                            +
                        </button>
                    </div>
                </div>
                <p className="dt-graph-summary">
                    {loadState === 'loading'
                        ? 'Loading module graph'
                        : `${visibleGraph.modules.length} of ${graph.modules.length} modules · ${visibleGraph.edges.length} edges`}
                    {visibleGraph.modules.length > graphLayout.nodes.length
                        ? ` · showing first ${graphLayout.nodes.length}`
                        : ''}
                </p>
                {loadState === 'error' ? (
                    <div className="dt-empty-pane" role="status">
                        <strong>Graph explorer unavailable</strong>
                        <p>{loadError}</p>
                    </div>
                ) : null}
            </Card>

            <div className="dt-graph-layout">
                <GraphCanvas
                    layout={graphLayout}
                    pan={pan}
                    selectedId={selectedModule?.id}
                    zoom={zoom}
                    onPan={setPan}
                    onSelect={setSelectedId}
                />
                <GraphDetails
                    moduleById={moduleById}
                    moduleNode={selectedModule}
                    openStatus={openStatus}
                    onOpenInEditor={() => {
                        void openSelectedModule();
                    }}
                    onSelect={setSelectedId}
                />
            </div>
        </section>
    );
}

function GraphCanvas({
    layout,
    pan,
    selectedId,
    zoom,
    onPan,
    onSelect
}: {
    layout: GraphLayout;
    pan: { x: number; y: number };
    selectedId: string | undefined;
    zoom: number;
    onPan: (pan: { x: number; y: number }) => void;
    onSelect: (id: string) => void;
}) {
    if (!layout.nodes.length) {
        return (
            <div className="dt-empty-pane" role="status">
                <strong>No matching modules</strong>
                <p>Adjust the module search or type filter.</p>
            </div>
        );
    }

    return (
        <Card title="Dependency map">
            <div className="dt-graph-pan-controls">
                <button
                    aria-label="Pan graph left"
                    onClick={() => {
                        onPan({ ...pan, x: pan.x - 60 });
                    }}
                    type="button"
                >
                    Left
                </button>
                <button
                    aria-label="Pan graph up"
                    onClick={() => {
                        onPan({ ...pan, y: pan.y - 40 });
                    }}
                    type="button"
                >
                    Up
                </button>
                <button
                    aria-label="Pan graph down"
                    onClick={() => {
                        onPan({ ...pan, y: pan.y + 40 });
                    }}
                    type="button"
                >
                    Down
                </button>
                <button
                    aria-label="Pan graph right"
                    onClick={() => {
                        onPan({ ...pan, x: pan.x + 60 });
                    }}
                    type="button"
                >
                    Right
                </button>
            </div>
            <svg
                aria-label="Module dependency graph"
                className="dt-graph-canvas"
                role="img"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            >
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    {layout.edges.map((edge) => {
                        const from = layout.nodes.find(
                            (node) => node.module.id === edge.from
                        );
                        const to = layout.nodes.find(
                            (node) => node.module.id === edge.to
                        );

                        if (!from || !to) {
                            return null;
                        }

                        return (
                            <line
                                className="dt-graph-edge"
                                key={`${edge.from}->${edge.to}`}
                                x1={from.x}
                                x2={to.x}
                                y1={from.y}
                                y2={to.y}
                            />
                        );
                    })}
                    {layout.nodes.map((node) => (
                        <GraphNode
                            key={node.module.id}
                            node={node}
                            selected={node.module.id === selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </g>
            </svg>
        </Card>
    );
}

function GraphNode({
    node,
    selected,
    onSelect
}: {
    node: GraphLayoutNode;
    selected: boolean;
    onSelect: (id: string) => void;
}) {
    const label = getModuleName(node.module);

    return (
        <g
            className={`dt-graph-node dt-graph-node--${node.module.kind}`}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => {
                onSelect(node.module.id);
            }}
            role="button"
            tabIndex={0}
            transform={`translate(${node.x} ${node.y})`}
        >
            <circle r={selected ? 14 : 11} />
            <text x="18" y="4">
                {label.length > 28 ? `${label.slice(0, 25)}...` : label}
            </text>
        </g>
    );
}

function GraphDetails({
    moduleById,
    moduleNode,
    openStatus,
    onOpenInEditor,
    onSelect
}: {
    moduleById: Map<string, ClientGraphModuleRecord>;
    moduleNode: ClientGraphModuleRecord | undefined;
    openStatus: string | undefined;
    onOpenInEditor: () => void;
    onSelect: (id: string) => void;
}) {
    if (!moduleNode) {
        return (
            <Card title="Module details">
                <div className="dt-empty-pane" role="status">
                    <strong>Select a module</strong>
                    <p>Importers and dependencies appear here.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card title="Module details">
            <div className="dt-graph-details">
                <div className="dt-graph-details__header">
                    <div>
                        <h2>{getModuleName(moduleNode)}</h2>
                        <p>{getModulePath(moduleNode)}</p>
                    </div>
                    <button
                        disabled={!moduleNode.filePath}
                        onClick={onOpenInEditor}
                        type="button"
                    >
                        Open in editor
                    </button>
                </div>
                <dl className="dt-graph-meta">
                    <GraphDetail
                        label="Type"
                        value={formatGraphKind(moduleNode.kind)}
                    />
                    <GraphDetail
                        label="Entry"
                        value={moduleNode.isEntry ? 'Yes' : 'No'}
                    />
                    <GraphDetail label="URL" value={moduleNode.url} />
                    <GraphDetail
                        label="File"
                        value={moduleNode.filePath ?? 'Virtual module'}
                    />
                </dl>
                <GraphRelationList
                    emptyLabel="No dependencies"
                    ids={moduleNode.importedIds}
                    moduleById={moduleById}
                    title="Dependencies"
                    onSelect={onSelect}
                />
                <GraphRelationList
                    emptyLabel="No importers"
                    ids={moduleNode.importerIds}
                    moduleById={moduleById}
                    title="Importers"
                    onSelect={onSelect}
                />
                {openStatus ? (
                    <p className="dt-graph-status" role="status">
                        {openStatus}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}

function GraphRelationList({
    emptyLabel,
    ids,
    moduleById,
    title,
    onSelect
}: {
    emptyLabel: string;
    ids: string[];
    moduleById: Map<string, ClientGraphModuleRecord>;
    title: string;
    onSelect: (id: string) => void;
}) {
    return (
        <section className="dt-graph-relations">
            <strong>{title}</strong>
            {ids.length ? (
                <ul>
                    {ids.map((id) => {
                        const moduleNode = moduleById.get(id);

                        return (
                            <li key={id}>
                                <button
                                    onClick={() => {
                                        onSelect(id);
                                    }}
                                    type="button"
                                >
                                    {moduleNode
                                        ? getModulePath(moduleNode)
                                        : id}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>{emptyLabel}</p>
            )}
        </section>
    );
}

function GraphDetail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

async function createGraphTransport(): Promise<GraphTransport> {
    const hot = getViteClientContext() ?? (await connectViteClientContext());

    if (!hot) {
        throw new Error('Vite hot context is not available.');
    }

    return createSerializedViteTransport(hot);
}

function createSerializedViteTransport(
    hot: ViteHotContextLike
): GraphTransport {
    const listeners = new Map<
        (payload: GraphPayload) => void,
        (payload: unknown) => void
    >();

    return {
        off(handler) {
            const listener = listeners.get(handler);

            if (!listener) {
                return;
            }

            listeners.delete(handler);
            hot.off?.(VITE_TRANSPORT_EVENT, listener);
        },
        on(handler) {
            const listener = (payload: unknown) => {
                const parsedPayload =
                    typeof payload === 'string' ? JSON.parse(payload) : payload;

                if (isRecord(parsedPayload)) {
                    handler(parsedPayload);
                }
            };

            listeners.set(handler, listener);
            hot.on(VITE_TRANSPORT_EVENT, listener);
        },
        post(payload) {
            hot.send(VITE_TRANSPORT_EVENT, JSON.stringify(payload));
        }
    };
}

function requestGraph(transport: GraphTransport): void {
    transport.post({
        requestId: getRequestId('graph:get'),
        type: VITE_GRAPH_RPC_GET_REQUEST
    });
}

function getVisibleGraph({
    graph,
    kindFilter,
    query,
    selectedId,
    selectionMode
}: {
    graph: ClientGraphSnapshot;
    kindFilter: ClientGraphModuleKind | 'all';
    query: string;
    selectedId: string | undefined;
    selectionMode: GraphSelectionMode;
}): ClientGraphSnapshot {
    const normalizedQuery = query.trim().toLowerCase();
    const relationIds =
        selectedId && selectionMode !== 'all'
            ? getRelationIds(graph, selectedId, selectionMode)
            : undefined;
    const modules = graph.modules.filter((moduleNode) => {
        const matchesKind =
            kindFilter === 'all' || moduleNode.kind === kindFilter;
        const matchesQuery =
            !normalizedQuery ||
            getModulePath(moduleNode).toLowerCase().includes(normalizedQuery) ||
            moduleNode.id.toLowerCase().includes(normalizedQuery);
        const matchesRelation = !relationIds || relationIds.has(moduleNode.id);

        return matchesKind && matchesQuery && matchesRelation;
    });
    const moduleIds = new Set(modules.map((moduleNode) => moduleNode.id));
    const edges = graph.edges.filter(
        (edge) => moduleIds.has(edge.from) && moduleIds.has(edge.to)
    );

    return { edges, modules };
}

function getRelationIds(
    graph: ClientGraphSnapshot,
    selectedId: string,
    selectionMode: Exclude<GraphSelectionMode, 'all'>
): Set<string> {
    const moduleById = new Map(
        graph.modules.map((moduleNode) => [moduleNode.id, moduleNode])
    );
    const selectedModule = moduleById.get(selectedId);
    const relationIds = new Set([selectedId]);

    if (!selectedModule) {
        return relationIds;
    }

    const ids =
        selectionMode === 'dependencies'
            ? selectedModule.importedIds
            : selectedModule.importerIds;
    ids.forEach((id) => {
        relationIds.add(id);
    });

    return relationIds;
}

function layoutGraph(graph: ClientGraphSnapshot): GraphLayout {
    const modules = graph.modules.slice(0, GRAPH_RENDER_LIMIT);
    const moduleIds = new Set(modules.map((moduleNode) => moduleNode.id));
    const centerX = GRAPH_WIDTH / 2;
    const centerY = GRAPH_HEIGHT / 2;
    const radiusX = GRAPH_WIDTH * 0.38;
    const radiusY = GRAPH_HEIGHT * 0.36;
    const nodes = modules.map((moduleNode, index) => {
        const angle = (index / Math.max(modules.length, 1)) * Math.PI * 2;

        return {
            module: moduleNode,
            x: centerX + Math.cos(angle) * radiusX,
            y: centerY + Math.sin(angle) * radiusY
        };
    });
    const edges = graph.edges.filter(
        (edge) => moduleIds.has(edge.from) && moduleIds.has(edge.to)
    );

    return { edges, nodes };
}

function getRequestId(prefix: string): string {
    requestSequence += 1;
    return `${prefix}:${requestSequence}`;
}

const graphKinds: ClientGraphModuleKind[] = [
    'tsx',
    'jsx',
    'ts',
    'js',
    'css',
    'html',
    'json',
    'asset',
    'other'
];

const graphSelectionModes: GraphSelectionMode[] = [
    'all',
    'dependencies',
    'importers'
];

function formatGraphKind(kind: ClientGraphModuleKind): string {
    if (kind === 'tsx' || kind === 'jsx' || kind === 'css' || kind === 'html') {
        return kind.toUpperCase();
    }

    return kind.slice(0, 1).toUpperCase() + kind.slice(1);
}

function formatSelectionMode(mode: GraphSelectionMode): string {
    if (mode === 'all') {
        return 'All';
    }

    return mode.slice(0, 1).toUpperCase() + mode.slice(1);
}

function getModulePath(moduleNode: ClientGraphModuleRecord): string {
    return moduleNode.relativePath ?? moduleNode.url ?? moduleNode.id;
}

function getModuleName(moduleNode: ClientGraphModuleRecord): string {
    const path = getModulePath(moduleNode);

    return path.split('/').at(-1) ?? path;
}

function isClientGraphSnapshot(value: unknown): value is ClientGraphSnapshot {
    return (
        isRecord(value) &&
        Array.isArray(value.modules) &&
        Array.isArray(value.edges) &&
        value.modules.every(isClientGraphModuleRecord) &&
        value.edges.every(isClientGraphEdgeRecord)
    );
}

function isClientGraphModuleRecord(
    value: unknown
): value is ClientGraphModuleRecord {
    return (
        isRecord(value) &&
        typeof value.id === 'string' &&
        Array.isArray(value.importedIds) &&
        Array.isArray(value.importerIds) &&
        typeof value.isEntry === 'boolean' &&
        typeof value.kind === 'string' &&
        typeof value.url === 'string'
    );
}

function isClientGraphEdgeRecord(
    value: unknown
): value is ClientGraphEdgeRecord {
    return (
        isRecord(value) &&
        typeof value.from === 'string' &&
        value.kind === 'import' &&
        typeof value.to === 'string'
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
