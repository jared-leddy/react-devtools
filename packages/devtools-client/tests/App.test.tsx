import {
    act,
    createEvent,
    fireEvent,
    render,
    screen,
    within,
    waitFor
} from '@testing-library/react';
import {
    addCustomCommand,
    addCustomTab,
    clearViteClientContext,
    resetDevToolsPluginRegistry,
    removeCustomCommand,
    setupDevToolsPlugin,
    setViteClientContext,
    type ViteHotContextLike
} from '@devtools/kit';
import {
    App,
    getClientSettingsSnapshot,
    resetClientCommandRegistryForTests,
    resetClientRuntimeForTests,
    resetClientRouteRegistryForTests,
    resetClientSettingsForTests,
    setClientSettingsStorageForTests,
    setClientSetting,
    setClientRouteEnvironment,
    setClientRuntimeState
} from '../src';

const VITE_TRANSPORT_EVENT = 'react-devtools:vite-transport-message';
const VITE_ASSET_RPC_LIST_REQUEST = 'devtools:assets:list';
const VITE_ASSET_RPC_LIST_RESPONSE = 'devtools:assets:list:response';
const VITE_ASSET_RPC_READ_REQUEST = 'devtools:assets:read';
const VITE_ASSET_RPC_READ_RESPONSE = 'devtools:assets:read:response';
const VITE_ASSET_UPDATE_EVENT = 'devtools:assets:update';
const VITE_GRAPH_RPC_GET_REQUEST = 'devtools:graph:get';
const VITE_GRAPH_RPC_GET_RESPONSE = 'devtools:graph:get:response';
const VITE_GRAPH_UPDATE_EVENT = 'devtools:graph:update';

interface TestAssetRecord {
    filePath: string;
    image?: {
        height?: number;
        type: string;
        width?: number;
    };
    importers?: string[];
    kind: 'audio' | 'font' | 'image' | 'other' | 'text' | 'video' | 'wasm';
    mtime: number;
    publicPath: string;
    relativePath: string;
    size: number;
}

interface TestAssetHotContext extends ViteHotContextLike {
    emitAssetUpdate: () => void;
    setAssets: (assets: TestAssetRecord[]) => void;
}

interface TestGraphModuleRecord {
    filePath?: string;
    id: string;
    importedIds: string[];
    importerIds: string[];
    isEntry: boolean;
    kind:
        | 'asset'
        | 'css'
        | 'html'
        | 'js'
        | 'json'
        | 'jsx'
        | 'other'
        | 'ts'
        | 'tsx';
    relativePath?: string;
    url: string;
}

interface TestGraphEdgeRecord {
    from: string;
    kind: 'import';
    to: string;
}

interface TestGraphSnapshot {
    edges: TestGraphEdgeRecord[];
    modules: TestGraphModuleRecord[];
}

interface TestGraphHotContext extends ViteHotContextLike {
    emitGraphUpdate: () => void;
    setGraph: (graph: TestGraphSnapshot) => void;
}

function createAssetRecord(
    asset: Partial<TestAssetRecord> &
        Pick<TestAssetRecord, 'kind' | 'relativePath'>
): TestAssetRecord {
    return {
        ...asset,
        filePath: `/project/${asset.relativePath}`,
        kind: asset.kind,
        mtime: Date.UTC(2026, 8, 24, 4, 0, 0),
        publicPath: `/@fs/project/${asset.relativePath}`,
        relativePath: asset.relativePath,
        size: asset.size ?? 128
    };
}

function createAssetHotContext(
    assets: TestAssetRecord[],
    options: { readResult?: unknown } = {}
): TestAssetHotContext {
    const handlers = new Map<string, Set<(payload: unknown) => void>>();
    let currentAssets = assets;
    const emit = (event: string, payload: unknown) => {
        handlers.get(event)?.forEach((handler) => {
            handler(JSON.stringify(payload));
        });
    };

    return {
        emitAssetUpdate() {
            emit(VITE_TRANSPORT_EVENT, { type: VITE_ASSET_UPDATE_EVENT });
        },
        off(event, handler) {
            handlers.get(event)?.delete(handler);
        },
        on(event, handler) {
            const eventHandlers = handlers.get(event) ?? new Set();
            eventHandlers.add(handler);
            handlers.set(event, eventHandlers);
        },
        send(event, payload) {
            const request =
                typeof payload === 'string'
                    ? (JSON.parse(payload) as Record<string, unknown>)
                    : {};

            if (request.type === VITE_ASSET_RPC_LIST_REQUEST) {
                emit(event, {
                    assets: currentAssets,
                    requestId: request.requestId,
                    type: VITE_ASSET_RPC_LIST_RESPONSE
                });
            }

            if (request.type === VITE_ASSET_RPC_READ_REQUEST) {
                emit(event, {
                    requestId: request.requestId,
                    result: options.readResult ?? {
                        content: 'body { color: red; }',
                        encoding: 'utf8',
                        filePath: request.filePath,
                        kind: 'text',
                        truncated: false
                    },
                    type: VITE_ASSET_RPC_READ_RESPONSE
                });
            }
        },
        setAssets(nextAssets) {
            currentAssets = nextAssets;
        }
    };
}

function createGraphModuleRecord(
    moduleNode: Partial<TestGraphModuleRecord> &
        Pick<TestGraphModuleRecord, 'id' | 'kind' | 'relativePath'>
): TestGraphModuleRecord {
    return {
        filePath: moduleNode.filePath ?? `/project/${moduleNode.relativePath}`,
        id: moduleNode.id,
        importedIds: moduleNode.importedIds ?? [],
        importerIds: moduleNode.importerIds ?? [],
        isEntry: moduleNode.isEntry ?? false,
        kind: moduleNode.kind,
        relativePath: moduleNode.relativePath,
        url: moduleNode.url ?? `/${moduleNode.relativePath}`
    };
}

function createGraphHotContext(
    graph: TestGraphSnapshot,
    options: { responseError?: string } = {}
): TestGraphHotContext {
    const handlers = new Map<string, Set<(payload: unknown) => void>>();
    let currentGraph = graph;
    const emit = (event: string, payload: unknown) => {
        handlers.get(event)?.forEach((handler) => {
            handler(JSON.stringify(payload));
        });
    };

    return {
        emitGraphUpdate() {
            emit(VITE_TRANSPORT_EVENT, { type: VITE_GRAPH_UPDATE_EVENT });
        },
        off(event, handler) {
            handlers.get(event)?.delete(handler);
        },
        on(event, handler) {
            const eventHandlers = handlers.get(event) ?? new Set();
            eventHandlers.add(handler);
            handlers.set(event, eventHandlers);
        },
        send(event, payload) {
            const request =
                typeof payload === 'string'
                    ? (JSON.parse(payload) as Record<string, unknown>)
                    : {};

            if (request.type === VITE_GRAPH_RPC_GET_REQUEST) {
                emit(
                    event,
                    options.responseError
                        ? {
                              error: options.responseError,
                              requestId: request.requestId,
                              type: VITE_GRAPH_RPC_GET_RESPONSE
                          }
                        : {
                              graph: currentGraph,
                              requestId: request.requestId,
                              type: VITE_GRAPH_RPC_GET_RESPONSE
                          }
                );
            }
        },
        setGraph(nextGraph) {
            currentGraph = nextGraph;
        }
    };
}

describe('@devtools/client App routing', () => {
    afterEach(() => {
        window.localStorage.clear();
        resetClientCommandRegistryForTests();
        resetClientRuntimeForTests();
        resetClientRouteRegistryForTests();
        resetClientSettingsForTests();
        clearViteClientContext();
        resetDevToolsPluginRegistry();
        jest.restoreAllMocks();
    });

    it.each([
        [
            '/timeline',
            'Timeline',
            'Timeline route reserved for future profiling work.'
        ]
    ])('renders %s', (path, heading, summary) => {
        render(<App initialEntries={[path]} />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: heading })
        ).toBeInTheDocument();
        expect(screen.getByLabelText(`${heading} page`)).toHaveTextContent(
            summary
        );
    });

    it('renders the Overview tab with runtime diagnostics', () => {
        render(<App initialEntries={['/overview']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Overview page')).toHaveTextContent(
            'Standalone'
        );
        expect(screen.getByText('Primary renderer')).toBeInTheDocument();
        expect(screen.getByText('React 18.3.1')).toBeInTheDocument();
        expect(screen.getByText('App root')).toBeInTheDocument();
        expect(screen.getByText('#root')).toBeInTheDocument();
        expect(screen.getByText('Standalone client')).toBeInTheDocument();
        expect(screen.getAllByText('12.4 ms')).toHaveLength(2);
    });

    it('renders Overview diagnostics for integrations and performance settings', () => {
        addCustomTab({
            category: 'third-party',
            name: 'module-health',
            title: 'Module Health'
        });
        setClientRouteEnvironment({
            capabilities: ['react-router', 'source-inspector'],
            transport: 'vite'
        });
        setClientSetting('highPerformanceMode', true);
        setClientSetting('timelineRecording', true);

        render(<App initialEntries={['/overview']} />);

        expect(screen.getByLabelText('Overview page')).toHaveTextContent(
            'Vite'
        );
        expect(screen.getAllByText('React Router')).toHaveLength(2);
        expect(screen.getAllByText('Source Inspector')).toHaveLength(2);
        expect(screen.getAllByText('Module Health')).toHaveLength(2);
        expect(
            screen.getByText('High performance mode').nextSibling
        ).toHaveTextContent('Enabled');
        expect(
            screen.getByText('Timeline recording').nextSibling
        ).toHaveTextContent('Enabled');
    });

    it('uses Overview to explain missing React trees', () => {
        setClientRouteEnvironment({ transport: 'iframe' });
        setClientRuntimeState({
            reactStatus: 'not-detected',
            rootStatus: 'empty'
        });

        render(<App initialEntries={['/overview']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
        expect(screen.getByText('Overlay iframe')).toBeInTheDocument();
        expect(screen.getByText('No renderers detected')).toBeInTheDocument();
        expect(screen.getByText('No roots found')).toBeInTheDocument();
        expect(screen.getAllByText('No commits recorded')).toHaveLength(2);
    });

    it('renders the Settings page controls', () => {
        render(<App initialEntries={['/settings']} />);

        expect(
            screen.getByRole('heading', { name: 'Settings' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Theme')).toBeInTheDocument();
        expect(screen.getByLabelText('Panel layout')).toBeInTheDocument();
        expect(screen.getByLabelText('Settings JSON')).toBeInTheDocument();
    });

    it('redirects the root route to overview', () => {
        render(<App initialEntries={['/']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
    });

    it('renders a not found page for unknown routes', () => {
        render(<App initialEntries={['/missing']} />);

        expect(
            screen.getByRole('heading', { name: 'Not found' })
        ).toBeInTheDocument();
    });

    it.each([
        [
            'waiting',
            'Waiting for connection',
            'waiting-for-connection',
            'waiting for an inspected React runtime to connect'
        ],
        [
            'disconnected',
            'Runtime disconnected',
            'transport-disconnected',
            'The inspected runtime disconnected'
        ],
        [
            'reconnecting',
            'Reconnecting',
            'transport-reconnecting',
            'attempting to reconnect'
        ]
    ] as const)(
        'renders the %s connection state',
        (connectionStatus, heading, label, copy) => {
            setClientRuntimeState({ connectionStatus });

            render(<App initialEntries={['/components']} />);

            expect(
                screen.getByRole('heading', { name: heading })
            ).toBeInTheDocument();
            expect(screen.getByLabelText(label)).toHaveTextContent(copy);
        }
    );

    it('renders a no-React-detected state after connection', () => {
        setClientRuntimeState({ reactStatus: 'not-detected' });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('heading', { name: 'No React detected' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('no-react-detected')).toHaveTextContent(
            'no React renderer has been detected'
        );
    });

    it('renders an unsupported React version state', () => {
        setClientRuntimeState({
            reactStatus: 'unsupported',
            unsupportedReactVersion: '16.7.0'
        });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('heading', {
                name: 'Unsupported React version'
            })
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('unsupported-react-version')
        ).toHaveTextContent(
            'React 16.7.0 is not supported by this devtools build.'
        );
    });

    it('hides Vite and adapter tabs until matching capabilities are detected', () => {
        const { queryByRole } = render(<App initialEntries={['/overview']} />);

        expect(queryByRole('link', { name: 'Assets' })).not.toBeInTheDocument();
        expect(
            queryByRole('link', { name: 'React Router' })
        ).not.toBeInTheDocument();
        expect(
            queryByRole('link', { name: 'Pages/Routes' })
        ).not.toBeInTheDocument();
    });

    it('shows Vite-only tabs when the active transport is Vite', async () => {
        setClientRouteEnvironment({
            capabilities: ['source-inspector'],
            transport: 'vite'
        });
        setViteClientContext(
            createGraphHotContext({
                edges: [],
                modules: [
                    createGraphModuleRecord({
                        id: '/project/src/App.tsx',
                        kind: 'tsx',
                        relativePath: 'src/App.tsx'
                    })
                ]
            })
        );

        render(<App initialEntries={['/graph']} />);

        expect(
            screen.getByRole('link', { name: 'Assets' })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Graph' })).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Source Inspector' })
        ).toBeInTheDocument();
        expect(
            await screen.findByText('1 of 1 modules · 0 edges')
        ).toBeInTheDocument();
    });

    it('keeps source inspector gated when only the Vite transport is detected', () => {
        setClientRouteEnvironment({ transport: 'vite' });

        render(<App initialEntries={['/source-inspector']} />);

        expect(
            screen.queryByRole('link', { name: 'Source Inspector' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Not found' })
        ).toBeInTheDocument();
    });

    it('renders the Vite Assets tab with filters, previews, importers, and editor actions', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            value: fetchMock
        });
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(
            createAssetHotContext([
                createAssetRecord({
                    image: { height: 24, type: 'png', width: 32 },
                    importers: ['src/App.tsx'],
                    kind: 'image',
                    relativePath: 'src/logo.png',
                    size: 2048
                }),
                createAssetRecord({
                    kind: 'text',
                    relativePath: 'src/notes.txt',
                    size: 18
                }),
                createAssetRecord({
                    kind: 'font',
                    relativePath: 'public/inter.woff2',
                    size: 4096
                })
            ])
        );

        render(<App initialEntries={['/assets']} />);

        expect(await screen.findAllByText('logo.png')).toHaveLength(2);
        expect(screen.getByLabelText('Assets page')).toHaveTextContent(
            '3 of 3 assets'
        );
        expect(screen.getByText('src/App.tsx')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/__open-in-editor?file=/project/src/logo.png'
            );
        });
        expect(
            await screen.findByText('Editor request sent')
        ).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search assets'), {
            target: { value: 'notes' }
        });
        expect(screen.getAllByText('notes.txt')).toHaveLength(2);
        expect(
            await screen.findByText('body { color: red; }')
        ).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter assets by type'), {
            target: { value: 'font' }
        });
        expect(screen.getByText('No matching assets')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search assets'), {
            target: { value: '' }
        });
        expect(screen.getAllByText('inter.woff2')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'List' }));
        expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('shows an Assets tab connection failure without a Vite hot context', async () => {
        setClientRouteEnvironment({ transport: 'vite' });

        render(<App initialEntries={['/assets']} />);

        expect(
            await screen.findByText('Asset explorer unavailable')
        ).toBeInTheDocument();
        expect(screen.getByText('No matching assets')).toBeInTheDocument();
        expect(screen.getByText('Select an asset')).toBeInTheDocument();
    });

    it('renders alternate asset previews and handles editor failures', async () => {
        const fetchMock = jest
            .fn()
            .mockRejectedValue(new Error('missing route'));
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            value: fetchMock
        });
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(
            createAssetHotContext([
                createAssetRecord({
                    kind: 'font',
                    relativePath: 'public/inter.woff2',
                    size: 2048 * 1024
                }),
                createAssetRecord({
                    kind: 'video',
                    relativePath: 'public/clip.mp4',
                    size: 512
                }),
                createAssetRecord({
                    kind: 'wasm',
                    relativePath: 'src/module.wasm',
                    size: 512
                })
            ])
        );

        render(<App initialEntries={['/assets']} />);

        expect(
            await screen.findByText('Aa Bb Cc 123 React DevTools')
        ).toBeInTheDocument();
        expect(screen.getByText('2.0 MB')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
        expect(
            await screen.findByText('Editor unavailable')
        ).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter assets by type'), {
            target: { value: 'video' }
        });
        expect(screen.getAllByText('Video').length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText('Filter assets by type'), {
            target: { value: 'all' }
        });
        fireEvent.change(screen.getByLabelText('Filter assets by extension'), {
            target: { value: '.wasm' }
        });
        expect(screen.getAllByText('Wasm').length).toBeGreaterThan(0);
    });

    it('falls back when text asset preview payloads are invalid', async () => {
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(
            createAssetHotContext(
                [
                    createAssetRecord({
                        kind: 'text',
                        relativePath: 'src/broken.txt',
                        size: 32
                    })
                ],
                { readResult: { content: false } }
            )
        );

        render(<App initialEntries={['/assets']} />);

        expect(
            await screen.findByText('Text preview unavailable')
        ).toBeInTheDocument();
    });

    it('caps large Vite asset lists and refreshes after update events', async () => {
        const hot = createAssetHotContext(
            Array.from({ length: 250 }, (_, index) =>
                createAssetRecord({
                    kind: 'image',
                    relativePath: `src/assets/icon-${index}.png`,
                    size: index + 1
                })
            )
        );
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(hot);

        render(<App initialEntries={['/assets']} />);

        expect(await screen.findAllByText('icon-0.png')).toHaveLength(2);
        expect(screen.getByText(/showing first 240/)).toBeInTheDocument();
        expect(screen.queryByText('icon-249.png')).not.toBeInTheDocument();

        hot.setAssets([
            createAssetRecord({
                kind: 'image',
                relativePath: 'src/assets/refreshed.png',
                size: 128
            })
        ]);
        act(() => {
            hot.emitAssetUpdate();
        });

        expect(await screen.findAllByText('refreshed.png')).toHaveLength(2);
        expect(screen.getByLabelText('Assets page')).toHaveTextContent(
            '1 of 1 assets'
        );
    });

    it('renders the Vite Graph tab with search, filters, relationships, pan/zoom, and editor actions', async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            value: fetchMock
        });
        const graph: TestGraphSnapshot = {
            edges: [
                {
                    from: '/project/index.html',
                    kind: 'import',
                    to: '/project/src/App.tsx'
                },
                {
                    from: '/project/src/App.tsx',
                    kind: 'import',
                    to: '/project/src/Button.jsx'
                },
                {
                    from: '/project/src/Button.jsx',
                    kind: 'import',
                    to: '/project/src/theme.css'
                },
                {
                    from: '/project/src/theme.css',
                    kind: 'import',
                    to: '/project/src/App.tsx'
                }
            ],
            modules: [
                createGraphModuleRecord({
                    id: '/project/src/App.tsx',
                    importedIds: ['/project/src/Button.jsx'],
                    importerIds: [
                        '/project/index.html',
                        '/project/src/theme.css'
                    ],
                    isEntry: true,
                    kind: 'tsx',
                    relativePath: 'src/App.tsx'
                }),
                createGraphModuleRecord({
                    id: '/project/index.html',
                    importedIds: ['/project/src/App.tsx'],
                    isEntry: true,
                    kind: 'html',
                    relativePath: 'index.html'
                }),
                createGraphModuleRecord({
                    id: '/project/src/Button.jsx',
                    importedIds: ['/project/src/theme.css'],
                    importerIds: ['/project/src/App.tsx'],
                    kind: 'jsx',
                    relativePath: 'src/Button.jsx'
                }),
                createGraphModuleRecord({
                    id: '/project/src/theme.css',
                    importedIds: ['/project/src/App.tsx'],
                    importerIds: ['/project/src/Button.jsx'],
                    kind: 'css',
                    relativePath: 'src/theme.css'
                })
            ]
        };
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(createGraphHotContext(graph));

        render(<App initialEntries={['/graph']} />);

        expect(
            await screen.findByText('4 of 4 modules · 4 edges')
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Module dependency graph')
        ).toBeInTheDocument();
        expect(screen.getAllByText('App.tsx')).toHaveLength(2);
        expect(screen.getAllByText('Dependencies')).toHaveLength(2);
        expect(
            screen.getByRole('button', { name: 'src/Button.jsx' })
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('button', { name: 'index.html' })
        ).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/__open-in-editor?file=/project/src/App.tsx'
            );
        });
        expect(
            await screen.findByText('Editor request sent')
        ).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search modules'), {
            target: { value: 'button' }
        });
        expect(
            screen.getByText('1 of 4 modules · 0 edges')
        ).toBeInTheDocument();
        expect(screen.getByText('Button.jsx')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search modules'), {
            target: { value: '' }
        });
        fireEvent.change(screen.getByLabelText('Filter modules by type'), {
            target: { value: 'css' }
        });
        expect(
            screen.getByText('1 of 4 modules · 0 edges')
        ).toBeInTheDocument();
        expect(screen.getByText('theme.css')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter modules by type'), {
            target: { value: 'all' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Dependencies' }));
        expect(
            screen.getByText('2 of 4 modules · 1 edges')
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '+' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Pan graph right' })
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('refreshes the Vite Graph tab after update events and handles connection failures', async () => {
        const initialGraph: TestGraphSnapshot = {
            edges: [],
            modules: [
                createGraphModuleRecord({
                    id: '/project/src/App.tsx',
                    kind: 'tsx',
                    relativePath: 'src/App.tsx'
                })
            ]
        };
        const hot = createGraphHotContext(initialGraph);
        setClientRouteEnvironment({ transport: 'vite' });
        setViteClientContext(hot);

        render(<App initialEntries={['/graph']} />);

        expect(
            await screen.findByText('1 of 1 modules · 0 edges')
        ).toBeInTheDocument();

        hot.setGraph({
            edges: [
                {
                    from: '/project/src/App.tsx',
                    kind: 'import',
                    to: '/project/src/Next.ts'
                }
            ],
            modules: [
                ...initialGraph.modules,
                createGraphModuleRecord({
                    id: '/project/src/Next.ts',
                    importerIds: ['/project/src/App.tsx'],
                    kind: 'ts',
                    relativePath: 'src/Next.ts'
                })
            ]
        });
        act(() => {
            hot.emitGraphUpdate();
        });

        expect(
            await screen.findByText('2 of 2 modules · 1 edges')
        ).toBeInTheDocument();

        clearViteClientContext();
        render(<App initialEntries={['/graph']} />);

        expect(
            await screen.findByText('Graph explorer unavailable')
        ).toBeInTheDocument();
        expect(screen.getByText('No matching modules')).toBeInTheDocument();
    });

    it('shows adapter routes after integration detection', () => {
        setClientRouteEnvironment({
            capabilities: ['react-router'],
            transport: 'standalone'
        });

        render(<App initialEntries={['/react-router']} />);

        expect(
            screen.getByRole('link', { name: 'Pages/Routes' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'React Router' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('React Router page')).toHaveTextContent(
            'React Router route tree and navigation state.'
        );
    });

    it('adds custom tabs from the plugin API as navigable routes', async () => {
        addCustomTab({
            category: 'third-party',
            name: 'module-health',
            title: 'Module Health'
        });

        render(<App initialEntries={['/custom-tab-view/module-health']} />);

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Module Health' })
            ).toBeInTheDocument();
        });
        expect(
            screen.getByRole('heading', { name: 'Module Health' })
        ).toBeInTheDocument();
        expect(screen.getByText('No custom tab view')).toBeInTheDocument();
    });

    it('renders iframe custom tabs with URL validation and persistence', async () => {
        addCustomTab({
            iframeUrl: 'https://example.com/devtools',
            name: 'iframe-report',
            persist: true,
            sandbox: 'allow-scripts allow-popups allow-top-navigation',
            title: 'Iframe Report'
        });

        render(<App initialEntries={['/custom-tab-view/iframe-report']} />);

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Iframe Report' })
            ).toBeInTheDocument();
        });

        const iframe = screen.getByTitle('Iframe Report');
        expect(iframe).toHaveAttribute('src', 'https://example.com/devtools');
        expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-popups');
        expect(iframe).toHaveAttribute('data-persist', 'true');
        expect(
            window.localStorage.getItem(
                'devtools.client.customTab.iframe-report.iframeUrl'
            )
        ).toBe('https://example.com/devtools');

        fireEvent.load(iframe);
        expect(screen.getByRole('status')).toHaveTextContent(
            'Custom iframe loaded.'
        );
    });

    it('blocks unsafe custom tab iframe URLs', async () => {
        addCustomTab({
            iframeUrl: 'javascript:alert(1)',
            name: 'unsafe-report',
            title: 'Unsafe Report'
        });

        render(<App initialEntries={['/custom-tab-view/unsafe-report']} />);

        await waitFor(() => {
            expect(screen.getByText('Custom tab blocked')).toBeInTheDocument();
        });
        expect(screen.queryByTitle('Unsafe Report')).not.toBeInTheDocument();
        expect(screen.getByText('Blocked iframe')).toBeInTheDocument();
    });

    it('renders React and dynamic-import custom tabs', async () => {
        addCustomTab({
            name: 'react-report',
            title: 'React Report',
            view: function ReactReport() {
                return <div>React custom tab body</div>;
            }
        });
        addCustomTab({
            name: 'dynamic-report',
            title: 'Dynamic Report',
            view: {
                loader: async () => ({
                    default: function DynamicReport() {
                        return <div>Dynamic custom tab body</div>;
                    }
                })
            }
        });

        const { unmount } = render(
            <App initialEntries={['/custom-tab-view/react-report']} />
        );

        await waitFor(() => {
            expect(
                screen.getByText('React custom tab body')
            ).toBeInTheDocument();
        });
        expect(screen.getByRole('status')).toHaveTextContent(
            'Custom React tab loaded.'
        );

        unmount();
        render(<App initialEntries={['/custom-tab-view/dynamic-report']} />);

        await waitFor(() => {
            expect(
                screen.getByText('Dynamic custom tab body')
            ).toBeInTheDocument();
        });
        expect(screen.getByRole('status')).toHaveTextContent(
            'Custom dynamic tab loaded.'
        );
    });

    it('groups unknown plugin tabs under the generic custom tab bucket', async () => {
        addCustomTab({
            category: 'unknown',
            name: 'feature-flags',
            title: 'Feature Flags'
        });

        const { container } = render(
            <App initialEntries={['/custom-tab-view/feature-flags']} />
        );

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Feature Flags' })
            ).toBeInTheDocument();
        });
        expect(
            container.querySelector('[data-route-category="custom"]')
        ).toHaveTextContent('Feature Flags');
    });

    it('adds custom inspectors registered by setupDevToolsPlugin as navigable tabs', async () => {
        render(
            <App
                initialEntries={['/custom-inspector-tab-view/nekuta-inspector']}
            />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'nekuta',
                    label: 'Nekuta'
                },
                (api) => {
                    api.addInspector({
                        id: 'nekuta-inspector',
                        label: 'Nekuta Inspector'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Nekuta Inspector' })
            ).toBeInTheDocument();
        });
        expect(
            screen.getByRole('heading', { name: 'Nekuta Inspector' })
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Nekuta Inspector page')
        ).toHaveTextContent('No inspector nodes');
    });

    it('renders custom inspector tree, state, actions, filters, and editable fields', async () => {
        const editHandler = jest.fn();
        let treeFilter = '';

        render(
            <App initialEntries={['/custom-inspector-tab-view/module-state']} />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'module-plugin',
                    label: 'Module plugin'
                },
                (api) => {
                    api.on.getInspectorTree('module-state', ({ filter }) => {
                        treeFilter = filter ?? '';

                        return [
                            {
                                children: [
                                    {
                                        id: 'route:settings',
                                        label: 'Settings route',
                                        tags: [{ label: 'route' }]
                                    }
                                ],
                                id: 'module:app',
                                label: 'App module',
                                tags: [{ label: 'module' }]
                            }
                        ].filter((node) =>
                            node.label
                                .toLowerCase()
                                .includes((filter ?? '').toLowerCase())
                        );
                    });
                    api.on.getInspectorState('module-state', ({ nodeId }) => ({
                        State: [
                            {
                                editable: true,
                                key: 'enabled',
                                value: nodeId === 'module:app'
                            },
                            {
                                key: 'owner',
                                value: 'module-plugin'
                            },
                            {
                                key: 'routes',
                                value: ['overview', 'settings']
                            },
                            {
                                editable: true,
                                key: 'metadata',
                                value: { packageName: 'module-plugin' }
                            }
                        ]
                    }));
                    api.on.editInspectorState('module-state', editHandler);
                    api.addInspector({
                        actions: [
                            {
                                action: 'refresh',
                                label: 'Refresh inspector'
                            }
                        ],
                        id: 'module-state',
                        label: 'Module State',
                        nodeActions: [
                            {
                                action: 'pin',
                                label: 'Pin node'
                            }
                        ],
                        stateFilterPlaceholder: 'Filter module state',
                        treeFilterPlaceholder: 'Filter modules'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(screen.getAllByText('App module')).toHaveLength(2);
        });

        expect(screen.getByText('module')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('enabled')).toBeInTheDocument();
            expect(screen.getByText('owner')).toBeInTheDocument();
        });
        expect(screen.getByText('Array(2)')).toBeInTheDocument();
        expect(screen.getByText('Object')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Pin node' })
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Refresh inspector' })
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            'Inspector action queued: Refresh inspector.'
        );

        fireEvent.change(screen.getByLabelText('Edit enabled value'), {
            target: { value: 'false' }
        });
        fireEvent.click(
            within(
                screen
                    .getByLabelText('Edit enabled value')
                    .closest('.dt-state-viewer__editor') as HTMLElement
            ).getByRole('button', { name: 'Save' })
        );

        await waitFor(() => {
            expect(editHandler).toHaveBeenCalledWith({
                inspectorId: 'module-state',
                nodeId: 'module:app',
                path: ['State', 0, 'enabled'],
                state: { value: false },
                type: 'set'
            });
        });
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                'Updated enabled.'
            );
        });

        const metadataEditor = screen
            .getByLabelText('Edit metadata value')
            .closest('.dt-state-viewer__editor') as HTMLElement;
        fireEvent.change(
            within(metadataEditor).getByLabelText('Edit metadata key'),
            {
                target: { value: 'package' }
            }
        );
        fireEvent.change(
            within(metadataEditor).getByLabelText('Edit metadata value'),
            {
                target: { value: '{"packageName":"module-plugin","hot":true}' }
            }
        );
        fireEvent.click(
            within(metadataEditor).getByRole('button', { name: 'Save' })
        );

        await waitFor(() => {
            expect(editHandler).toHaveBeenCalledWith({
                inspectorId: 'module-state',
                nodeId: 'module:app',
                path: ['State', 3, 'metadata'],
                state: {
                    newKey: 'package',
                    value: { hot: true, packageName: 'module-plugin' }
                },
                type: 'set'
            });
        });
        await waitFor(() => {
            expect(screen.getByText('package')).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(
                'Updated package.'
            );
        });

        const packageEditor = screen
            .getByLabelText('Edit package value')
            .closest('.dt-state-viewer__editor') as HTMLElement;
        fireEvent.click(
            within(packageEditor).getByRole('button', { name: 'Remove' })
        );

        await waitFor(() => {
            expect(editHandler).toHaveBeenCalledWith({
                inspectorId: 'module-state',
                nodeId: 'module:app',
                path: ['State', 3, 'package'],
                state: { remove: true },
                type: 'remove'
            });
        });
        await waitFor(() => {
            expect(screen.queryByText('package')).not.toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent(
                'Removed package.'
            );
        });

        fireEvent.change(screen.getByLabelText('Tree filter'), {
            target: { value: 'missing' }
        });

        await waitFor(() => {
            expect(treeFilter).toBe('missing');
        });
        expect(screen.getByText('No inspector nodes')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'About' }));
        expect(screen.getByText('Inspector id')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        expect(screen.getByText('No inspector settings')).toBeInTheDocument();
    });

    it('surfaces failed custom inspector edits without optimistic mutation', async () => {
        const editHandler = jest
            .fn()
            .mockRejectedValue(new Error('Plugin edit rejected.'));

        render(
            <App initialEntries={['/custom-inspector-tab-view/edit-failure']} />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'edit-failure-plugin',
                    label: 'Edit failure plugin'
                },
                (api) => {
                    api.on.getInspectorTree('edit-failure', () => [
                        {
                            id: 'settings',
                            label: 'Settings'
                        }
                    ]);
                    api.on.getInspectorState('edit-failure', () => ({
                        State: [
                            {
                                editable: true,
                                key: 'mode',
                                value: 'light'
                            }
                        ]
                    }));
                    api.on.editInspectorState('edit-failure', editHandler);
                    api.addInspector({
                        id: 'edit-failure',
                        label: 'Edit Failure'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(
                screen.getByLabelText('Edit mode value')
            ).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Edit mode value'), {
            target: { value: 'dark' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                'Plugin edit rejected.'
            );
        });
        expect(screen.getByText('"light"')).toBeInTheDocument();
        expect(screen.queryByText('"dark"')).not.toBeInTheDocument();
    });

    it('updates custom inspector selection and filters state fields', async () => {
        render(
            <App initialEntries={['/custom-inspector-tab-view/module-state']} />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'module-plugin',
                    label: 'Module plugin'
                },
                (api) => {
                    api.on.getInspectorTree('module-state', () => [
                        {
                            children: [
                                {
                                    id: 'route:settings',
                                    label: 'Settings route'
                                }
                            ],
                            id: 'module:app',
                            label: 'App module'
                        }
                    ]);
                    api.on.getInspectorState('module-state', ({ nodeId }) => ({
                        State: [
                            {
                                editable: true,
                                key: 'enabled',
                                value: nodeId === 'module:app'
                            },
                            {
                                key: 'owner',
                                value: nodeId
                            }
                        ]
                    }));
                    api.addInspector({
                        id: 'module-state',
                        label: 'Module State',
                        nodeActions: [{ action: 'pin', label: 'Pin node' }]
                    });
                }
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Settings route')).toBeInTheDocument();
        });
        fireEvent.keyDown(
            screen.getByRole('tree', { name: 'Custom inspector tree' }),
            { key: 'ArrowDown' }
        );

        await waitFor(() => {
            expect(screen.getByText('route:settings')).toBeInTheDocument();
        });
        expect(screen.getByText('false')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Pin node' }));
        expect(screen.getByRole('status')).toHaveTextContent(
            'Node action queued: Pin node.'
        );

        fireEvent.change(screen.getByLabelText('State filter'), {
            target: { value: 'owner' }
        });

        await waitFor(() => {
            expect(screen.queryByText('enabled')).not.toBeInTheDocument();
        });
        expect(screen.getByText('owner')).toBeInTheDocument();
    });

    it('surfaces custom inspector tree and state loading failures', async () => {
        const { unmount } = render(
            <App initialEntries={['/custom-inspector-tab-view/failing']} />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'failing-plugin',
                    label: 'Failing plugin'
                },
                (api) => {
                    api.on.getInspectorTree('failing', () => {
                        throw new Error('Tree unavailable');
                    });
                    api.addInspector({
                        id: 'failing',
                        label: 'Failing Inspector'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Tree unavailable')).toBeInTheDocument();
        });

        unmount();
        resetDevToolsPluginRegistry();
        resetClientRouteRegistryForTests();
        window.localStorage.clear();

        render(
            <App
                initialEntries={['/custom-inspector-tab-view/state-failing']}
            />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'state-failing-plugin',
                    label: 'State failing plugin'
                },
                (api) => {
                    api.on.getInspectorTree('state-failing', () => [
                        {
                            id: 'node:one',
                            label: 'Node one'
                        }
                    ]);
                    api.on.getInspectorState('state-failing', () => {
                        throw 'state failed';
                    });
                    api.addInspector({
                        id: 'state-failing',
                        label: 'State Failing Inspector'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(
                screen.getByText('Inspector state failed to load.')
            ).toBeInTheDocument();
        });
    });

    it('can render without the default memory router wrapper', () => {
        render(<App router="none" />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
    });

    it('toggles and persists the client theme from the shell header', async () => {
        render(<App initialEntries={['/overview']} />);

        const themeToggle = screen.getByRole('button', { name: 'Dark' });
        const themeRoot = themeToggle.closest('.dt-ui');

        expect(themeRoot).toHaveAttribute('data-theme', 'dark');

        fireEvent.click(themeToggle);

        await waitFor(() => {
            expect(themeRoot).toHaveAttribute('data-theme', 'light');
        });
        expect(
            screen.getByRole('button', { name: 'Light' })
        ).toBeInTheDocument();
        expect(
            window.localStorage.getItem('devtools.client.settings')
        ).toContain('"theme":"light"');
    });

    it('persists settings across remounts', () => {
        const { unmount } = render(<App initialEntries={['/settings']} />);

        fireEvent.change(screen.getByLabelText('Panel layout'), {
            target: { value: 'compact' }
        });
        fireEvent.click(screen.getByLabelText('High performance mode'));
        fireEvent.change(screen.getByLabelText('Tree filter'), {
            target: { value: 'Provider' }
        });

        expect(
            window.localStorage.getItem('devtools.client.settings')
        ).toContain('"panelLayout":"compact"');

        unmount();
        render(<App initialEntries={['/settings']} />);

        expect(screen.getByLabelText('Panel layout')).toHaveValue('compact');
        expect(screen.getByLabelText('High performance mode')).toBeChecked();
        expect(screen.getByLabelText('Tree filter')).toHaveValue('Provider');
    });

    it('imports, exports, and resets settings from the Settings page', async () => {
        render(<App initialEntries={['/settings']} />);

        fireEvent.change(screen.getByLabelText('Theme'), {
            target: { value: 'light' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Export' }));

        expect(
            (screen.getByLabelText('Settings JSON') as HTMLTextAreaElement)
                .value
        ).toContain('"theme": "light"');

        fireEvent.change(screen.getByLabelText('Settings JSON'), {
            target: {
                value: JSON.stringify({
                    highPerformanceMode: true,
                    panelLayout: 'compact',
                    reduceMotion: true,
                    stateFilter: 'hooks',
                    theme: 'dark',
                    timelineRecording: true,
                    treeFilter: 'Provider'
                })
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Import' }));

        expect(
            await screen.findByText('Settings imported.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Theme')).toHaveValue('dark');
        expect(screen.getByLabelText('Panel layout')).toHaveValue('compact');
        expect(screen.getByLabelText('Reduce motion')).toBeChecked();
        expect(screen.getByLabelText('Timeline recording')).toBeChecked();
        expect(screen.getByLabelText('State filter')).toHaveValue('hooks');

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

        expect(screen.getByLabelText('Theme')).toHaveValue('dark');
        expect(screen.getByLabelText('Panel layout')).toHaveValue(
            'comfortable'
        );
        expect(screen.getByLabelText('Reduce motion')).not.toBeChecked();
        expect(screen.getByLabelText('Settings JSON')).toHaveValue('');
    });

    it('can persist settings through a custom storage adapter', () => {
        const values = new Map<string, string>();

        setClientSettingsStorageForTests({
            getItem: (key) => values.get(key) ?? null,
            removeItem: (key) => {
                values.delete(key);
            },
            setItem: (key, value) => {
                values.set(key, value);
            }
        });

        render(<App initialEntries={['/settings']} />);
        fireEvent.change(screen.getByLabelText('State filter'), {
            target: { value: 'stateful' }
        });

        expect(getClientSettingsSnapshot().stateFilter).toBe('stateful');
        expect(Array.from(values.values()).join('\n')).toContain(
            '"stateFilter":"stateful"'
        );
    });

    it('opens the command palette with the keyboard shortcut and filters commands', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.keyDown(window, { ctrlKey: true, key: 'k' });

        expect(
            screen.getByRole('dialog', { name: 'Command palette' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: /Go to Components/i })
        ).toBeInTheDocument();

        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'settings' }
            }
        );

        expect(
            screen.getByRole('option', { name: /Go to Settings/i })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('option', { name: /Go to Components/i })
        ).not.toBeInTheDocument();
    });

    it('runs navigation commands from the command palette', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'settings' }
            }
        );
        fireEvent.click(
            screen.getByRole('option', { name: /Go to Settings/i })
        );

        expect(
            screen.queryByRole('dialog', { name: 'Command palette' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Settings' })
        ).toBeInTheDocument();
    });

    it('runs the active command palette option with keyboard navigation', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));

        const search = screen.getByRole('searchbox', {
            name: 'Search commands'
        });
        fireEvent.keyDown(search, { key: 'ArrowDown' });
        fireEvent.keyDown(search, { key: 'Enter' });

        expect(
            screen.queryByRole('dialog', { name: 'Command palette' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
    });

    it('wraps command palette keyboard selection and closes on Escape', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));

        const search = screen.getByRole('searchbox', {
            name: 'Search commands'
        });
        fireEvent.keyDown(search, { key: 'ArrowUp' });

        expect(
            screen.getByRole('option', { name: /Open project docs/i })
        ).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(search, { key: 'Escape' });
        expect(
            screen.queryByRole('dialog', { name: 'Command palette' })
        ).not.toBeInTheDocument();
    });

    it('runs URL commands from the command palette', () => {
        const open = jest.spyOn(window, 'open').mockImplementation();

        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'react docs' }
            }
        );
        fireEvent.click(
            screen.getByRole('option', { name: /Open React docs/i })
        );

        expect(open).toHaveBeenCalledWith(
            'https://react.dev',
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('shows nested plugin commands and removes them after unregistering', async () => {
        render(<App initialEntries={['/overview']} />);

        act(() => {
            addCustomCommand({
                children: [
                    {
                        id: 'open-child-report',
                        label: 'Open child report',
                        route: '/timeline'
                    }
                ],
                id: 'plugin-tools',
                label: 'Plugin tools'
            });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'child report' }
            }
        );

        await waitFor(() => {
            expect(
                screen.getByRole('option', { name: /Open child report/i })
            ).toBeInTheDocument();
        });
        expect(screen.getByText('Plugins / Plugin tools')).toBeInTheDocument();

        act(() => {
            removeCustomCommand('plugin-tools');
        });

        await waitFor(() => {
            expect(
                screen.queryByRole('option', { name: /Open child report/i })
            ).not.toBeInTheDocument();
        });
    });

    it('renders the components split-pane layout', () => {
        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Component details' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('separator', { name: 'Resize panes' })
        ).toHaveAttribute('aria-valuenow', '42');
    });

    it('resizes the components split-pane layout from the keyboard', () => {
        render(<App initialEntries={['/components']} />);

        const divider = screen.getByRole('separator', {
            name: 'Resize panes'
        });

        fireEvent.keyDown(divider, { key: 'ArrowRight' });
        expect(divider).toHaveAttribute('aria-valuenow', '46');

        fireEvent.keyDown(divider, { key: 'ArrowLeft' });
        expect(divider).toHaveAttribute('aria-valuenow', '42');

        fireEvent.keyDown(divider, { key: 'Home' });
        expect(divider).toHaveAttribute('aria-valuenow', '24');

        fireEvent.keyDown(divider, { key: 'End' });
        expect(divider).toHaveAttribute('aria-valuenow', '76');
    });

    it('renders empty-root panes when React has no mounted components', () => {
        setClientRuntimeState({ rootStatus: 'empty' });

        render(<App initialEntries={['/components']} />);

        expect(screen.getByText('Empty React root')).toBeInTheDocument();
        expect(screen.getByText('No component selected')).toBeInTheDocument();
        expect(
            screen.getByText(
                'React is connected, but no mounted components were found in the current root.'
            )
        ).toBeInTheDocument();
    });

    it('renders a deliberate no-selection detail pane', () => {
        setClientRuntimeState({ selectionStatus: 'none' });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
        expect(screen.getByText('No component selected')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Choose a component from the tree to inspect its props, hooks, and state.'
            )
        ).toBeInTheDocument();
    });

    it('syncs selected component state from the route and updates details after selection', () => {
        render(
            <App
                initialEntries={[
                    '/components?componentId=component-group-0-child-5'
                ]}
            />
        );

        expect(screen.getAllByText('ComponentLeaf0_5')).toHaveLength(2);
        expect(
            screen.getByText('component-group-0-child-5')
        ).toBeInTheDocument();

        const nextTreeLabel = screen.getAllByText('ComponentLeaf0_6')[0];
        fireEvent.click(nextTreeLabel.closest('button') as Element);

        expect(screen.getAllByText('ComponentLeaf0_6')).toHaveLength(2);
        expect(
            screen.getByText('component-group-0-child-6')
        ).toBeInTheDocument();
    });

    it('persists the last selected tab and per-tab path state', async () => {
        const { unmount } = render(
            <App
                initialEntries={[
                    '/components?componentId=component-group-0-child-5'
                ]}
            />
        );

        await waitFor(() => {
            expect(
                window.localStorage.getItem('devtools.client.lastRoute')
            ).toBe('/components');
        });
        expect(
            JSON.parse(
                window.localStorage.getItem('devtools.client.tabState') ?? '{}'
            )
        ).toMatchObject({
            components: {
                path: '/components?componentId=component-group-0-child-5'
            }
        });

        unmount();
        render(<App initialEntries={['/']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
    });

    it('updates and persists the components split ratio after dragging the divider', () => {
        const { unmount } = render(<App initialEntries={['/components']} />);
        const splitPane = screen.getByRole('region', {
            name: 'Resizable split pane'
        });
        const divider = screen.getByRole('separator', {
            name: 'Resize panes'
        });

        jest.spyOn(splitPane, 'getBoundingClientRect').mockReturnValue({
            bottom: 420,
            height: 420,
            left: 100,
            right: 900,
            top: 0,
            width: 800,
            x: 100,
            y: 0,
            toJSON: () => ({})
        });

        const pointerDown = createPointerEvent(divider, 'pointerDown', {
            clientX: 500,
            pointerId: 1
        });
        const pointerMove = createPointerEvent(window, 'pointerMove', {
            clientX: 700
        });

        fireEvent(divider, pointerDown);
        fireEvent(window, pointerMove);
        fireEvent.pointerUp(window);

        expect(divider).toHaveAttribute('aria-valuenow', '75');
        expect(
            window.localStorage.getItem('devtools.client.components.splitRatio')
        ).toBe('0.75');

        unmount();
        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('separator', { name: 'Resize panes' })
        ).toHaveAttribute('aria-valuenow', '75');
    });
});

function createPointerEvent(
    target: Window | Element,
    eventName: 'pointerDown' | 'pointerMove',
    init: { clientX: number; pointerId?: number }
) {
    const event = createEvent[eventName](target);

    Object.defineProperties(event, {
        clientX: { value: init.clientX },
        pointerId: { value: init.pointerId ?? 1 }
    });

    return event;
}
