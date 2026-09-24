import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@devtools/ui';
import {
    connectViteClientContext,
    getViteClientContext,
    type ViteHotContextLike
} from '@devtools/kit';

const VITE_TRANSPORT_EVENT = 'react-devtools:vite-transport-message';
const VITE_ASSET_RPC_LIST_REQUEST = 'devtools:assets:list';
const VITE_ASSET_RPC_LIST_RESPONSE = 'devtools:assets:list:response';
const VITE_ASSET_RPC_READ_REQUEST = 'devtools:assets:read';
const VITE_ASSET_RPC_READ_RESPONSE = 'devtools:assets:read:response';
const VITE_ASSET_UPDATE_EVENT = 'devtools:assets:update';
const ASSET_RENDER_LIMIT = 240;
const TEXT_PREVIEW_BYTES = 32 * 1024;

export type ClientAssetKind =
    'audio' | 'font' | 'image' | 'other' | 'text' | 'video' | 'wasm';

export interface ClientAssetRecord {
    filePath: string;
    image?: {
        height?: number;
        type: string;
        width?: number;
    };
    importers?: string[];
    kind: ClientAssetKind;
    mtime: number;
    publicPath: string;
    relativePath: string;
    size: number;
}

interface ClientAssetReadResult {
    content: string;
    encoding: 'utf8';
    filePath: string;
    kind: ClientAssetKind;
    truncated: boolean;
}

type AssetViewMode = 'grid' | 'list';
type AssetLoadState = 'idle' | 'loading' | 'ready' | 'error';
type ViteAssetPayload = Record<string, unknown>;

interface AssetTransport {
    off: (handler: (payload: ViteAssetPayload) => void) => void;
    on: (handler: (payload: ViteAssetPayload) => void) => void;
    post: (payload: ViteAssetPayload) => void;
}

let requestSequence = 0;

export function AssetsPage() {
    const [assets, setAssets] = useState<ClientAssetRecord[]>([]);
    const [selectedPath, setSelectedPath] = useState<string | undefined>();
    const [query, setQuery] = useState('');
    const [kindFilter, setKindFilter] = useState<ClientAssetKind | 'all'>(
        'all'
    );
    const [extensionFilter, setExtensionFilter] = useState('all');
    const [viewMode, setViewMode] = useState<AssetViewMode>('grid');
    const [loadState, setLoadState] = useState<AssetLoadState>('idle');
    const [loadError, setLoadError] = useState<string | undefined>();
    const [textPreview, setTextPreview] = useState<ClientAssetReadResult>();
    const [textPreviewState, setTextPreviewState] =
        useState<AssetLoadState>('idle');
    const [openStatus, setOpenStatus] = useState<string | undefined>();
    const transportRef = useRef<AssetTransport | null>(null);

    const extensions = useMemo(
        () =>
            Array.from(
                new Set(
                    assets
                        .map((asset) => getAssetExtension(asset.relativePath))
                        .filter(Boolean)
                )
            ).sort(),
        [assets]
    );
    const filteredAssets = useMemo(
        () =>
            assets.filter((asset) => {
                const normalizedQuery = query.trim().toLowerCase();
                const extension = getAssetExtension(asset.relativePath);
                const matchesQuery =
                    !normalizedQuery ||
                    asset.relativePath
                        .toLowerCase()
                        .includes(normalizedQuery) ||
                    getAssetName(asset.relativePath)
                        .toLowerCase()
                        .includes(normalizedQuery);
                const matchesKind =
                    kindFilter === 'all' || asset.kind === kindFilter;
                const matchesExtension =
                    extensionFilter === 'all' || extension === extensionFilter;

                return matchesQuery && matchesKind && matchesExtension;
            }),
        [assets, extensionFilter, kindFilter, query]
    );
    const visibleAssets = filteredAssets.slice(0, ASSET_RENDER_LIMIT);
    const selectedAsset =
        filteredAssets.find((asset) => asset.relativePath === selectedPath) ??
        filteredAssets[0];

    useEffect(() => {
        let disposed = false;
        let cleanup: (() => void) | undefined;

        async function connectAndLoad() {
            setLoadState('loading');
            setLoadError(undefined);

            try {
                const transport = await createAssetTransport();

                if (disposed) {
                    return;
                }

                transportRef.current = transport;
                const handlePayload = (payload: ViteAssetPayload) => {
                    if (payload.type === VITE_ASSET_UPDATE_EVENT) {
                        requestAssetList(transport);
                        return;
                    }

                    if (payload.type !== VITE_ASSET_RPC_LIST_RESPONSE) {
                        return;
                    }

                    const responseAssets = Array.isArray(payload.assets)
                        ? payload.assets.filter(isClientAssetRecord)
                        : [];
                    setAssets(responseAssets);
                    setSelectedPath((currentPath) =>
                        currentPath &&
                        responseAssets.some(
                            (asset) => asset.relativePath === currentPath
                        )
                            ? currentPath
                            : responseAssets[0]?.relativePath
                    );
                    setLoadState('ready');
                };

                transport.on(handlePayload);
                cleanup = () => {
                    transport.off(handlePayload);
                };
                requestAssetList(transport);
            } catch (error) {
                if (!disposed) {
                    setLoadState('error');
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to connect to the Vite asset explorer.'
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

    useEffect(() => {
        const transport = transportRef.current;

        if (!transport || selectedAsset?.kind !== 'text') {
            setTextPreview(undefined);
            setTextPreviewState('idle');
            return;
        }

        const requestId = getRequestId('assets:read');
        const handlePayload = (payload: ViteAssetPayload) => {
            if (
                payload.type !== VITE_ASSET_RPC_READ_RESPONSE ||
                payload.requestId !== requestId
            ) {
                return;
            }

            if (isClientAssetReadResult(payload.result)) {
                setTextPreview(payload.result);
                setTextPreviewState('ready');
                return;
            }

            setTextPreview(undefined);
            setTextPreviewState('error');
        };

        setTextPreview(undefined);
        setTextPreviewState('loading');
        transport.on(handlePayload);
        transport.post({
            filePath: selectedAsset.filePath,
            maxBytes: TEXT_PREVIEW_BYTES,
            requestId,
            type: VITE_ASSET_RPC_READ_REQUEST
        });

        return () => {
            transport.off(handlePayload);
        };
    }, [selectedAsset]);

    async function openSelectedAsset() {
        if (!selectedAsset) {
            return;
        }

        setOpenStatus('Opening editor');

        try {
            const response = await fetch(
                `/__open-in-editor?file=${encodeURI(selectedAsset.filePath)}`
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
            aria-label="Assets page"
            className="dt-client-shell__page dt-assets-page"
        >
            <Card title="Assets">
                <div className="dt-assets-toolbar">
                    <label>
                        Search
                        <input
                            aria-label="Search assets"
                            onChange={(event) => {
                                setQuery(event.target.value);
                            }}
                            placeholder="src/logo"
                            type="search"
                            value={query}
                        />
                    </label>
                    <label>
                        Type
                        <select
                            aria-label="Filter assets by type"
                            onChange={(event) => {
                                setKindFilter(
                                    event.target.value as
                                        ClientAssetKind | 'all'
                                );
                            }}
                            value={kindFilter}
                        >
                            <option value="all">All types</option>
                            {assetKinds.map((kind) => (
                                <option key={kind} value={kind}>
                                    {formatAssetKind(kind)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Extension
                        <select
                            aria-label="Filter assets by extension"
                            onChange={(event) => {
                                setExtensionFilter(event.target.value);
                            }}
                            value={extensionFilter}
                        >
                            <option value="all">All extensions</option>
                            {extensions.map((extension) => (
                                <option key={extension} value={extension}>
                                    {extension}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div
                        aria-label="Asset view mode"
                        className="dt-assets-view-toggle"
                    >
                        <button
                            aria-pressed={viewMode === 'grid'}
                            onClick={() => {
                                setViewMode('grid');
                            }}
                            type="button"
                        >
                            Grid
                        </button>
                        <button
                            aria-pressed={viewMode === 'list'}
                            onClick={() => {
                                setViewMode('list');
                            }}
                            type="button"
                        >
                            List
                        </button>
                    </div>
                </div>
                <p className="dt-assets-summary">
                    {loadState === 'loading'
                        ? 'Loading assets'
                        : `${filteredAssets.length} of ${assets.length} assets`}
                    {filteredAssets.length > visibleAssets.length
                        ? ` · showing first ${visibleAssets.length}`
                        : ''}
                </p>
                {loadState === 'error' ? (
                    <div className="dt-empty-pane" role="status">
                        <strong>Asset explorer unavailable</strong>
                        <p>{loadError}</p>
                    </div>
                ) : null}
            </Card>

            <div className="dt-assets-layout">
                <AssetCollection
                    assets={visibleAssets}
                    selectedAsset={selectedAsset}
                    viewMode={viewMode}
                    onSelect={(asset) => {
                        setSelectedPath(asset.relativePath);
                    }}
                />
                <AssetPreview
                    asset={selectedAsset}
                    openStatus={openStatus}
                    textPreview={textPreview}
                    textPreviewState={textPreviewState}
                    onOpenInEditor={() => {
                        void openSelectedAsset();
                    }}
                />
            </div>
        </section>
    );
}

function AssetCollection({
    assets,
    selectedAsset,
    viewMode,
    onSelect
}: {
    assets: ClientAssetRecord[];
    selectedAsset: ClientAssetRecord | undefined;
    viewMode: AssetViewMode;
    onSelect: (asset: ClientAssetRecord) => void;
}) {
    if (!assets.length) {
        return (
            <div className="dt-empty-pane" role="status">
                <strong>No matching assets</strong>
                <p>Adjust the asset search, type, or extension filter.</p>
            </div>
        );
    }

    return (
        <div
            aria-label="Asset results"
            className={`dt-assets-list dt-assets-list--${viewMode}`}
        >
            {assets.map((asset) => (
                <button
                    aria-pressed={
                        asset.relativePath === selectedAsset?.relativePath
                    }
                    className="dt-assets-list__item"
                    key={asset.relativePath}
                    onClick={() => {
                        onSelect(asset);
                    }}
                    type="button"
                >
                    <AssetThumb asset={asset} />
                    <span className="dt-assets-list__body">
                        <strong>{getAssetName(asset.relativePath)}</strong>
                        <span>{asset.relativePath}</span>
                        <small>
                            {formatAssetKind(asset.kind)} ·{' '}
                            {formatBytes(asset.size)}
                        </small>
                    </span>
                </button>
            ))}
        </div>
    );
}

function AssetThumb({ asset }: { asset: ClientAssetRecord }) {
    if (asset.kind === 'image') {
        return (
            <span className="dt-assets-thumb dt-assets-thumb--image">
                <img alt="" src={asset.publicPath} />
            </span>
        );
    }

    return (
        <span className={`dt-assets-thumb dt-assets-thumb--${asset.kind}`}>
            {asset.kind.slice(0, 1).toUpperCase()}
        </span>
    );
}

function AssetPreview({
    asset,
    openStatus,
    textPreview,
    textPreviewState,
    onOpenInEditor
}: {
    asset: ClientAssetRecord | undefined;
    openStatus: string | undefined;
    textPreview: ClientAssetReadResult | undefined;
    textPreviewState: AssetLoadState;
    onOpenInEditor: () => void;
}) {
    if (!asset) {
        return (
            <Card title="Preview">
                <div className="dt-empty-pane" role="status">
                    <strong>Select an asset</strong>
                    <p>Asset details and previews appear here.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card title="Preview">
            <div className="dt-assets-preview">
                <div className="dt-assets-preview__header">
                    <div>
                        <h2>{getAssetName(asset.relativePath)}</h2>
                        <p>{asset.relativePath}</p>
                    </div>
                    <button onClick={onOpenInEditor} type="button">
                        Open in editor
                    </button>
                </div>
                <AssetPreviewSurface
                    asset={asset}
                    textPreview={textPreview}
                    textPreviewState={textPreviewState}
                />
                <dl className="dt-assets-details">
                    <AssetDetail
                        label="Type"
                        value={formatAssetKind(asset.kind)}
                    />
                    <AssetDetail label="Size" value={formatBytes(asset.size)} />
                    <AssetDetail
                        label="Modified"
                        value={new Date(asset.mtime).toLocaleString()}
                    />
                    <AssetDetail label="File" value={asset.filePath} />
                    {asset.image ? (
                        <AssetDetail
                            label="Image"
                            value={[
                                asset.image.type.toUpperCase(),
                                asset.image.width && asset.image.height
                                    ? `${asset.image.width}x${asset.image.height}`
                                    : undefined
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        />
                    ) : null}
                </dl>
                <div className="dt-assets-importers">
                    <strong>Importers</strong>
                    {asset.importers?.length ? (
                        <ul>
                            {asset.importers.map((importer) => (
                                <li key={importer}>{importer}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No importers reported yet.</p>
                    )}
                </div>
                {openStatus ? (
                    <p className="dt-assets-status" role="status">
                        {openStatus}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}

function AssetPreviewSurface({
    asset,
    textPreview,
    textPreviewState
}: {
    asset: ClientAssetRecord;
    textPreview: ClientAssetReadResult | undefined;
    textPreviewState: AssetLoadState;
}) {
    if (asset.kind === 'image') {
        return (
            <div className="dt-assets-preview__surface">
                <img alt={asset.relativePath} src={asset.publicPath} />
            </div>
        );
    }

    if (asset.kind === 'font') {
        const fontName = `dt-asset-${hashString(asset.relativePath)}`;

        return (
            <div className="dt-assets-preview__surface dt-assets-preview__font">
                <style>{`@font-face{font-family:"${fontName}";src:url("${asset.publicPath}")}`}</style>
                <p style={{ fontFamily: fontName }}>
                    Aa Bb Cc 123 React DevTools
                </p>
            </div>
        );
    }

    if (asset.kind === 'text') {
        return (
            <pre className="dt-assets-preview__text">
                {textPreviewState === 'loading'
                    ? 'Loading text preview'
                    : (textPreview?.content ?? 'Text preview unavailable')}
                {textPreview?.truncated ? '\n…' : ''}
            </pre>
        );
    }

    return (
        <div className="dt-assets-preview__surface dt-assets-preview__placeholder">
            {formatAssetKind(asset.kind)}
        </div>
    );
}

function AssetDetail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

async function createAssetTransport(): Promise<AssetTransport> {
    const hot = getViteClientContext() ?? (await connectViteClientContext());

    if (!hot) {
        throw new Error('Vite hot context is not available.');
    }

    return createSerializedViteTransport(hot);
}

function createSerializedViteTransport(
    hot: ViteHotContextLike
): AssetTransport {
    const listeners = new Map<
        (payload: ViteAssetPayload) => void,
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

function requestAssetList(transport: AssetTransport): void {
    transport.post({
        requestId: getRequestId('assets:list'),
        type: VITE_ASSET_RPC_LIST_REQUEST
    });
}

function getRequestId(prefix: string): string {
    requestSequence += 1;
    return `${prefix}:${requestSequence}`;
}

const assetKinds: ClientAssetKind[] = [
    'image',
    'text',
    'font',
    'video',
    'audio',
    'wasm',
    'other'
];

function formatAssetKind(kind: ClientAssetKind): string {
    return kind.slice(0, 1).toUpperCase() + kind.slice(1);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getAssetName(path: string): string {
    return path.split('/').at(-1) ?? path;
}

function getAssetExtension(path: string): string {
    const name = getAssetName(path);
    const dotIndex = name.lastIndexOf('.');

    return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
}

function hashString(value: string): string {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash.toString(36);
}

function isClientAssetRecord(value: unknown): value is ClientAssetRecord {
    return (
        isRecord(value) &&
        typeof value.filePath === 'string' &&
        typeof value.kind === 'string' &&
        typeof value.mtime === 'number' &&
        typeof value.publicPath === 'string' &&
        typeof value.relativePath === 'string' &&
        typeof value.size === 'number'
    );
}

function isClientAssetReadResult(
    value: unknown
): value is ClientAssetReadResult {
    return (
        isRecord(value) &&
        typeof value.content === 'string' &&
        typeof value.filePath === 'string' &&
        typeof value.kind === 'string' &&
        typeof value.truncated === 'boolean'
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
