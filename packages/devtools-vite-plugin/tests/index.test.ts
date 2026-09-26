import { Writable } from 'node:stream';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    DEFAULT_CLIENT_BASE_PATH,
    DEVTOOLS_TOGGLE_SHORTCUT_HINT,
    DEFAULT_OVERLAY_BASE_PATH,
    DEFAULT_OVERLAY_SCRIPT_PATH,
    OPEN_IN_EDITOR_PATH,
    VITE_ASSET_RPC_LIST_REQUEST,
    VITE_ASSET_RPC_LIST_RESPONSE,
    VITE_ASSET_RPC_READ_REQUEST,
    VITE_ASSET_RPC_READ_RESPONSE,
    VITE_ASSET_UPDATE_EVENT,
    VITE_GRAPH_RPC_GET_REQUEST,
    VITE_GRAPH_RPC_GET_RESPONSE,
    VITE_GRAPH_UPDATE_EVENT,
    classifyAsset,
    classifyViteGraphModule,
    createOverlayScriptTag,
    getDefaultClientDir,
    getDefaultOverlayDir,
    getDevtoolsClientBasePath,
    getDevtoolsOverlayBasePath,
    getDevtoolsOverlayScriptPath,
    getViteModuleGraphSnapshot,
    handleViteAssetRpcPayload,
    handleViteGraphRpcPayload,
    injectOverlayScript,
    installViteAssetRpc,
    installViteGraphRpc,
    listViteAssets,
    normalizeServePath,
    reactDevtools,
    readViteAssetText,
    resolveDevtoolsUrls,
    shouldTransformSourceMetadata,
    shouldTransformComponentInspector,
    transformReactSourceMetadata
} from '../src';
import type { ViteTransportPayload } from '../src/viteTransport';
import {
    VITE_TRANSPORT_EVENT,
    createViteTransportChannel
} from '../src/viteTransport';

class MockServerResponse extends Writable {
    readonly headers = new Map<string, number | string | string[]>();
    body = '';
    statusCode = 200;

    _write(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void
    ) {
        this.body += chunk.toString();
        callback();
    }

    getHeader(name: string) {
        return this.headers.get(name.toLowerCase());
    }

    setHeader(name: string, value: number | string | string[]) {
        this.headers.set(name.toLowerCase(), value);
        return this;
    }

    writeHead(statusCode: number, headers?: Record<string, string | number>) {
        this.statusCode = statusCode;

        Object.entries(headers ?? {}).forEach(([name, value]) => {
            this.setHeader(name, value);
        });

        return this;
    }
}

function createMockViteServer(clientDir: string) {
    const use = jest.fn();
    const plugin = reactDevtools({ clientDir });
    const configureServer = plugin.configureServer as (server: never) => void;

    configureServer({
        middlewares: {
            use
        }
    } as never);

    return use;
}

async function createAssetFixture() {
    const root = await mkdtemp(join(tmpdir(), 'devtools-assets-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'public'), { recursive: true });
    await mkdir(join(root, 'dist'), { recursive: true });
    await mkdir(join(root, 'node_modules/pkg'), { recursive: true });
    await writeFile(join(root, 'src/logo.png'), createPngBuffer(2, 3));
    await writeFile(join(root, 'src/readme.txt'), 'hello asset explorer');
    await writeFile(join(root, 'public/theme.css'), 'body { color: red; }');
    await writeFile(join(root, 'src/sound.mp3'), Buffer.from([0, 1, 2]));
    await writeFile(join(root, 'src/font.woff2'), Buffer.from([3, 4, 5]));
    await writeFile(join(root, 'src/module.wasm'), Buffer.from([0, 97, 115]));
    await writeFile(join(root, 'src/blob.bin'), Buffer.from([6, 7, 8]));
    await writeFile(join(root, 'dist/ignored.png'), createPngBuffer(1, 1));
    await writeFile(join(root, 'package-lock.json'), '{}');
    await writeFile(join(root, 'node_modules/pkg/file.svg'), '<svg />');

    return root;
}

function createPngBuffer(width: number, height: number) {
    const buffer = Buffer.alloc(24);
    buffer[0] = 0x89;
    buffer.write('PNG', 1, 'ascii');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);

    return buffer;
}

function createGifBuffer(width: number, height: number) {
    const buffer = Buffer.alloc(10);
    buffer.write('GIF89a', 0, 'ascii');
    buffer.writeUInt16LE(width, 6);
    buffer.writeUInt16LE(height, 8);

    return buffer;
}

function createJpegBuffer(width: number, height: number) {
    return Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xc0,
        0x00,
        0x11,
        0x08,
        (height >> 8) & 0xff,
        height & 0xff,
        (width >> 8) & 0xff,
        width & 0xff,
        0x03,
        0x01,
        0x11,
        0x00,
        0x02,
        0x11,
        0x00,
        0x03,
        0x11,
        0x00
    ]);
}

function createWebpBuffer(width: number, height: number) {
    const buffer = Buffer.alloc(30);
    buffer.write('RIFF', 0, 'ascii');
    buffer.write('WEBP', 8, 'ascii');
    buffer.write('VP8X', 12, 'ascii');
    buffer.writeUIntLE(width - 1, 24, 3);
    buffer.writeUIntLE(height - 1, 27, 3);

    return buffer;
}

interface TestModuleNode {
    file?: string;
    id: string;
    importedModules: Set<TestModuleNode>;
    importers: Set<TestModuleNode>;
    isEntry?: boolean;
    url: string;
}

function createModuleNode(
    id: string,
    options: { file?: string; isEntry?: boolean; url?: string } = {}
): TestModuleNode {
    return {
        file: options.file,
        id,
        importedModules: new Set(),
        importers: new Set(),
        isEntry: options.isEntry,
        url: options.url ?? id
    };
}

function linkModule(
    importer: TestModuleNode,
    dependency: TestModuleNode
): void {
    importer.importedModules.add(dependency);
    dependency.importers.add(importer);
}

function createModuleGraphFixture() {
    const root = '/project';
    const app = createModuleNode('/project/src/App.tsx', {
        file: '/project/src/App.tsx',
        isEntry: true,
        url: '/src/App.tsx'
    });
    const button = createModuleNode('/project/src/Button.jsx', {
        file: '/project/src/Button.jsx',
        url: '/src/Button.jsx'
    });
    const theme = createModuleNode('/project/src/theme.css', {
        file: '/project/src/theme.css',
        url: '/src/theme.css'
    });
    const data = createModuleNode('/project/src/data.json', {
        file: '/project/src/data.json',
        url: '/src/data.json'
    });
    const logo = createModuleNode('/project/public/logo.svg', {
        file: '/project/public/logo.svg',
        url: '/public/logo.svg'
    });
    const html = createModuleNode('/project/index.html', {
        file: '/project/index.html',
        isEntry: true,
        url: '/index.html'
    });

    linkModule(html, app);
    linkModule(app, button);
    linkModule(app, theme);
    linkModule(app, data);
    linkModule(app, logo);

    const modules = [app, button, theme, data, logo, html];

    return {
        modules,
        root,
        server: {
            moduleGraph: {
                idToModuleMap: new Map(
                    modules.map((moduleNode) => [moduleNode.id, moduleNode])
                ),
                urlToModuleMap: new Map(
                    modules.map((moduleNode) => [moduleNode.url, moduleNode])
                )
            }
        }
    };
}

async function requestMiddleware(
    middleware: (request: object, response: object, next: () => void) => void,
    url: string
) {
    const response = new MockServerResponse();
    let missed = false;

    middleware({ headers: {}, method: 'GET', url }, response, () => {
        missed = true;
        response.end();
    });

    await new Promise<void>((resolve) => {
        response.on('finish', resolve);
    });

    return { missed, response };
}

describe('reactDevtools', () => {
    it('returns a Vite plugin object that is safe to load from config', () => {
        const plugin = reactDevtools();

        expect(plugin).toMatchObject({
            name: 'vite-plugin-react-devtools',
            apply: 'serve',
            enforce: 'pre'
        });
        expect(plugin.configureServer).toEqual(expect.any(Function));
        expect(plugin.transformIndexHtml).toEqual(expect.any(Function));
    });

    it('injects the overlay module script into HTML', () => {
        const plugin = reactDevtools();
        const transformIndexHtml = plugin.transformIndexHtml as (
            html: string,
            ctx: never
        ) => unknown;
        const result = transformIndexHtml(
            '<html><head></head><body></body></html>',
            {} as never
        );

        expect(result).toContain(
            `<script type="module" src="${DEFAULT_OVERLAY_SCRIPT_PATH}" data-react-devtools-client-url="${DEFAULT_CLIENT_BASE_PATH}" data-react-devtools-separate-window-url="${DEFAULT_CLIENT_BASE_PATH}"></script>`
        );
    });

    it('serves the client bundle through Vite middleware', () => {
        const use = jest.fn();
        const plugin = reactDevtools({ clientDir: '/tmp/client' });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use
            }
        } as never);

        expect(use).toHaveBeenCalledWith(
            DEFAULT_CLIENT_BASE_PATH,
            expect.any(Function)
        );
    });

    it('serves the overlay bundle through Vite middleware', () => {
        const use = jest.fn();
        const plugin = reactDevtools({
            clientDir: '/tmp/client',
            overlayDir: '/tmp/overlay'
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use
            }
        } as never);

        expect(use).toHaveBeenCalledWith(
            DEFAULT_OVERLAY_BASE_PATH,
            expect.any(Function)
        );
    });

    it('normalizes custom serve paths', () => {
        expect(normalizeServePath('__devtools__')).toBe('/__devtools__/');
        expect(normalizeServePath('/__devtools__')).toBe('/__devtools__/');
        expect(normalizeServePath('/__devtools__/')).toBe('/__devtools__/');
    });

    it('derives base-aware devtools serve paths and URLs', () => {
        const server = {
            config: {
                base: '/admin/',
                server: {}
            },
            resolvedUrls: {
                local: ['http://localhost:5173/admin/'],
                network: ['http://192.168.1.10:5173/admin/']
            }
        } as never;

        expect(getDevtoolsClientBasePath({}, server)).toBe(
            '/admin/__devtools__/'
        );
        expect(getDevtoolsOverlayBasePath({}, server)).toBe(
            '/admin/__react-devtools-overlay__/'
        );
        expect(getDevtoolsOverlayScriptPath({}, server)).toBe(
            '/admin/__react-devtools-overlay__/devtools-overlay.js'
        );
        expect(resolveDevtoolsUrls(server, {})).toEqual([
            'http://localhost:5173/admin/__devtools__/',
            'http://192.168.1.10:5173/admin/__devtools__/'
        ]);
    });

    it('prints the separate-window devtools URL and shortcut after Vite starts', () => {
        jest.useFakeTimers();

        const logger = { info: jest.fn() };
        const httpServer = {
            once: jest.fn((_event: string, handler: () => void) => {
                handler();
            })
        };
        const plugin = reactDevtools();
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            config: {
                base: '/workspace/',
                logger,
                server: {}
            },
            httpServer,
            middlewares: {
                use: jest.fn()
            },
            resolvedUrls: {
                local: ['http://localhost:5173/workspace/'],
                network: []
            }
        } as never);

        jest.runOnlyPendingTimers();
        jest.useRealTimers();

        expect(logger.info).toHaveBeenCalledWith(
            'React DevTools: http://localhost:5173/workspace/__devtools__/'
        );
        expect(logger.info).toHaveBeenCalledWith(
            `React DevTools shortcut: ${DEVTOOLS_TOGGLE_SHORTCUT_HINT}`
        );
    });

    it('opens project-root files through the editor endpoint', async () => {
        const launch = jest.fn();
        const root = await mkdtemp(join(tmpdir(), 'devtools-editor-'));
        const use = jest.fn();
        const plugin = reactDevtools({
            openInEditor: { command: 'test-editor', launch }
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        try {
            await mkdir(join(root, 'src'), { recursive: true });
            await writeFile(join(root, 'src/App.tsx'), '<App />');

            configureServer({
                config: { root },
                middlewares: { use }
            } as never);

            const middleware = use.mock.calls[0][0];
            const { missed, response } = await requestMiddleware(
                middleware,
                `${OPEN_IN_EDITOR_PATH}?file=${encodeURIComponent(
                    join(root, 'src/App.tsx')
                )}&line=12&column=8`
            );

            expect(missed).toBe(false);
            expect(response.statusCode).toBe(202);
            expect(response.getHeader('content-type')).toBe(
                'application/json;charset=utf-8'
            );
            expect(launch).toHaveBeenCalledWith('test-editor', [
                join(root, 'src/App.tsx') + ':12:8'
            ]);
            expect(JSON.parse(response.body)).toMatchObject({
                command: 'test-editor',
                file: join(root, 'src/App.tsx'),
                ok: true
            });
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('supports custom editor arguments', async () => {
        const launch = jest.fn();
        const root = await mkdtemp(join(tmpdir(), 'devtools-editor-'));
        const use = jest.fn();
        const plugin = reactDevtools({
            openInEditor: {
                args: ['--goto', '{file}', '--line', '{line}'],
                command: 'custom-editor',
                launch
            }
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        try {
            configureServer({
                config: { root },
                middlewares: { use }
            } as never);

            const middleware = use.mock.calls[0][0];
            await requestMiddleware(
                middleware,
                `${OPEN_IN_EDITOR_PATH}?file=src/App.tsx&line=4`
            );

            expect(launch).toHaveBeenCalledWith('custom-editor', [
                '--goto',
                join(root, 'src/App.tsx'),
                '--line',
                '4'
            ]);
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('rejects invalid editor endpoint requests', async () => {
        const launch = jest.fn();
        const root = await mkdtemp(join(tmpdir(), 'devtools-editor-'));
        const use = jest.fn();
        const plugin = reactDevtools({
            openInEditor: { command: 'test-editor', launch }
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        try {
            configureServer({
                config: { root },
                middlewares: { use }
            } as never);

            const middleware = use.mock.calls[0][0];
            const missingFile = await requestMiddleware(
                middleware,
                OPEN_IN_EDITOR_PATH
            );
            const rootEscape = await requestMiddleware(
                middleware,
                `${OPEN_IN_EDITOR_PATH}?file=${encodeURIComponent('/tmp/escape.tsx')}`
            );

            expect(missingFile.response.statusCode).toBe(400);
            expect(JSON.parse(missingFile.response.body)).toMatchObject({
                error: 'Missing required file query parameter.'
            });
            expect(rootEscape.response.statusCode).toBe(403);
            expect(JSON.parse(rootEscape.response.body)).toMatchObject({
                error: 'File must be inside the Vite project root.'
            });
            expect(launch).not.toHaveBeenCalled();
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('returns the standalone client index through the devtools middleware', async () => {
        const use = createMockViteServer(
            join(process.cwd(), 'tests/fixtures/client')
        );
        const middleware = use.mock.calls[1][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            '/index.html'
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.getHeader('content-type')).toBe(
            'text/html;charset=utf-8'
        );
        expect(response.body).toContain('React DevTools standalone client');
    });

    it('returns the standalone client index from the real mounted path', async () => {
        const use = createMockViteServer(
            join(process.cwd(), 'tests/fixtures/client')
        );
        const middleware = use.mock.calls[1][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            `${DEFAULT_CLIENT_BASE_PATH}index.html`
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('React DevTools standalone client');
    });

    it('returns client assets through the devtools middleware', async () => {
        const use = createMockViteServer(
            join(process.cwd(), 'tests/fixtures/client')
        );
        const middleware = use.mock.calls[1][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            '/assets/client.js'
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.getHeader('content-type')).toBe('text/javascript');
        expect(response.body).toContain('reactDevtoolsClient');
    });

    it('applies Vite server headers to served devtools assets', async () => {
        const use = jest.fn();
        const plugin = reactDevtools({
            clientDir: join(process.cwd(), 'tests/fixtures/client')
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            config: {
                server: {
                    headers: {
                        'Cross-Origin-Embedder-Policy': 'require-corp'
                    }
                }
            },
            middlewares: { use }
        } as never);

        const middleware = use.mock.calls[1][1];
        const { response } = await requestMiddleware(
            middleware,
            '/assets/client.js'
        );

        expect(response.getHeader('cross-origin-embedder-policy')).toBe(
            'require-corp'
        );
    });

    it('returns overlay assets through the overlay middleware', async () => {
        const use = jest.fn();
        const plugin = reactDevtools({
            clientDir: join(process.cwd(), 'tests/fixtures/client'),
            overlayDir: join(process.cwd(), 'tests/fixtures/overlay')
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use
            }
        } as never);

        const middleware = use.mock.calls[3][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            '/devtools-overlay.js'
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('__react-devtools-overlay__');
    });

    it('returns overlay assets from the real mounted path', async () => {
        const use = jest.fn();
        const plugin = reactDevtools({
            clientDir: join(process.cwd(), 'tests/fixtures/client'),
            overlayDir: join(process.cwd(), 'tests/fixtures/overlay')
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use
            }
        } as never);

        const middleware = use.mock.calls[3][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            DEFAULT_OVERLAY_SCRIPT_PATH
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('__react-devtools-overlay__');
    });

    it('returns overlay assets through the explicit full-path middleware', async () => {
        const use = jest.fn();
        const plugin = reactDevtools({
            clientDir: join(process.cwd(), 'tests/fixtures/client'),
            overlayDir: join(process.cwd(), 'tests/fixtures/overlay')
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use
            }
        } as never);

        const rootMiddlewares = use.mock.calls
            .map((call) => call[0])
            .filter((middleware) => typeof middleware === 'function');
        const middleware = rootMiddlewares.at(-1);

        const { missed, response } = await requestMiddleware(
            middleware,
            DEFAULT_OVERLAY_SCRIPT_PATH
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('__react-devtools-overlay__');
    });

    it('supports appendTo by prepending an overlay import to matching modules', () => {
        const plugin = reactDevtools({ appendTo: /src\/main\.tsx$/ });
        const transform = plugin.transform as (
            code: string,
            id: string
        ) => unknown;

        expect(
            transform('console.log("app");', '/project/src/main.tsx')
        ).toEqual({
            code: `window.__REACT_DEVTOOLS_OVERLAY_CONFIG__ = { clientUrl: "${DEFAULT_CLIENT_BASE_PATH}", separateWindowUrl: "${DEFAULT_CLIENT_BASE_PATH}" };\nimport '${DEFAULT_OVERLAY_SCRIPT_PATH}';\nconsole.log("app");`,
            map: null
        });
        expect(transform('console.log("app");', '/project/src/other.tsx')).toBe(
            undefined
        );
    });

    it('annotates JSX modules with source metadata in development', () => {
        const plugin = reactDevtools();
        const transform = plugin.transform as (
            code: string,
            id: string
        ) => {
            code: string;
            map: {
                sources: string[];
                sourcesContent: string[];
                version: number;
            };
        };
        const code = [
            'export function App() {',
            '    return <main><Button label="Save" /></main>;',
            '}'
        ].join('\n');
        const result = transform(code, '/project/src/App.tsx');

        expect(result.code).toContain(
            '<main data-react-devtools-source="/project/src/App.tsx:2:13" data-react-devtools-component-id="/project/src/App.tsx:2:13:main" data-react-devtools-display-name="main">'
        );
        expect(result.code).toContain(
            '<Button label="Save" data-react-devtools-source="/project/src/App.tsx:2:19" data-react-devtools-component-id="/project/src/App.tsx:2:19:Button" data-react-devtools-display-name="Button" />'
        );
        expect(result.map.version).toBe(3);
        expect(result.map.sources).toEqual(['/project/src/App.tsx']);
        expect(result.map.sourcesContent).toEqual([code]);
    });

    it('does not annotate TypeScript generic arguments as JSX tags', () => {
        const result = transformReactSourceMetadata(
            [
                "type ThemeTone = 'active' | 'quiet';",
                "const ThemeContext = createContext<ThemeTone>('active');",
                'export function App() {',
                '    return <main><span>Ready</span></main>;',
                '}'
            ].join('\n'),
            '/project/src/App.tsx'
        );

        expect(result?.code).toContain("createContext<ThemeTone>('active');");
        expect(result?.code).toContain(
            '<main data-react-devtools-source="/project/src/App.tsx:4:13">'
        );
        expect(result?.code).toContain(
            '<span data-react-devtools-source="/project/src/App.tsx:4:19">'
        );
    });

    it('composes source metadata with appendTo overlay imports', () => {
        const plugin = reactDevtools({ appendTo: /src\/main\.tsx$/ });
        const transform = plugin.transform as (
            code: string,
            id: string
        ) => {
            code: string;
        };
        const result = transform('<App />', '/project/src/main.tsx');

        expect(result.code).toBe(
            `window.__REACT_DEVTOOLS_OVERLAY_CONFIG__ = { clientUrl: "${DEFAULT_CLIENT_BASE_PATH}", separateWindowUrl: "${DEFAULT_CLIENT_BASE_PATH}" };\nimport '${DEFAULT_OVERLAY_SCRIPT_PATH}';\n<App data-react-devtools-source="/project/src/main.tsx:3:2" data-react-devtools-component-id="/project/src/main.tsx:3:2:App" data-react-devtools-display-name="App" />`
        );
    });

    it('supports source metadata and component inspector include/exclude filters', () => {
        expect(
            shouldTransformSourceMetadata('/project/src/App.tsx', false)
        ).toBe(false);
        expect(
            shouldTransformSourceMetadata('/project/src/App.tsx', {
                exclude: 'src/App'
            })
        ).toBe(false);
        expect(
            shouldTransformSourceMetadata('/project/src/App.tsx', {
                include: /src\/App\.tsx$/
            })
        ).toBe(true);
        expect(shouldTransformSourceMetadata('/project/src/App.ts', {})).toBe(
            false
        );
        expect(
            shouldTransformComponentInspector('/project/src/App.tsx', false)
        ).toBe(false);
        expect(
            shouldTransformComponentInspector('/project/src/App.tsx', {
                exclude: 'src/App'
            })
        ).toBe(false);
        expect(
            shouldTransformComponentInspector('/project/src/App.tsx', {
                include: /src\/App\.tsx$/
            })
        ).toBe(true);
    });

    it('leaves production-like files and existing source annotations unchanged', () => {
        expect(
            transformReactSourceMetadata(
                '<App data-react-devtools-source="manual" />',
                '/project/src/App.tsx'
            )
        ).toBe(undefined);
        expect(
            transformReactSourceMetadata(
                'const text = "<App />";\n// <Ignored />',
                '/project/src/App.tsx'
            )
        ).toBe(undefined);

        const componentOnlyPlugin = reactDevtools({ sourceMetadata: false });
        const componentOnlyTransform = componentOnlyPlugin.transform as (
            code: string,
            id: string
        ) => { code: string };
        const componentOnlyResult = componentOnlyTransform(
            '<App />',
            '/project/src/App.tsx'
        );

        expect(componentOnlyResult.code).toBe(
            '<App data-react-devtools-component-id="/project/src/App.tsx:1:2:App" data-react-devtools-display-name="App" />'
        );

        const plugin = reactDevtools({
            componentInspector: false,
            sourceMetadata: false
        });
        const transform = plugin.transform as (
            code: string,
            id: string
        ) => unknown;

        expect(transform('<App />', '/project/src/App.tsx')).toBe(undefined);
    });

    it('skips HTML injection when appendTo is configured', () => {
        const plugin = reactDevtools({ appendTo: 'src/main.tsx' });
        const transformIndexHtml = plugin.transformIndexHtml as (
            html: string,
            ctx: never
        ) => unknown;
        const html = '<html><head></head><body></body></html>';

        expect(transformIndexHtml(html, {} as never)).toBe(html);
    });

    it('builds idempotent overlay script tags', () => {
        const html = '<html><head></head><body></body></html>';
        const injected = injectOverlayScript(html);

        expect(createOverlayScriptTag()).toBe(
            `<script type="module" src="${DEFAULT_OVERLAY_SCRIPT_PATH}" data-react-devtools-client-url="${DEFAULT_CLIENT_BASE_PATH}" data-react-devtools-separate-window-url="${DEFAULT_CLIENT_BASE_PATH}"></script>`
        );
        expect(injectOverlayScript(injected)).toBe(injected);
        expect(injectOverlayScript('<main></main>')).toContain('<main></main>');
    });

    it('defaults bundle locations through dependency resolution', () => {
        expect(getDefaultClientDir()).toContain('dist/standalone');
        expect(getDefaultOverlayDir()).toContain('dist');
    });

    it('lists Vite project assets with classification and image metadata', async () => {
        const root = await createAssetFixture();

        try {
            const assets = await listViteAssets(root);
            const relativePaths = assets.map((asset) => asset.relativePath);

            expect(relativePaths).toEqual([
                'public/theme.css',
                'src/blob.bin',
                'src/font.woff2',
                'src/logo.png',
                'src/module.wasm',
                'src/readme.txt',
                'src/sound.mp3'
            ]);
            expect(
                assets.map((asset) => [asset.relativePath, asset.kind])
            ).toEqual([
                ['public/theme.css', 'text'],
                ['src/blob.bin', 'other'],
                ['src/font.woff2', 'font'],
                ['src/logo.png', 'image'],
                ['src/module.wasm', 'wasm'],
                ['src/readme.txt', 'text'],
                ['src/sound.mp3', 'audio']
            ]);
            expect(
                assets.find((asset) => asset.relativePath === 'src/logo.png')
                    ?.image
            ).toEqual({ height: 3, type: 'png', width: 2 });
            expect(
                assets.every((asset) => asset.publicPath.startsWith('/@fs/'))
            ).toBe(true);
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('reads image metadata across browser asset formats', async () => {
        const root = await mkdtemp(join(tmpdir(), 'devtools-assets-'));

        try {
            await mkdir(join(root, 'src'), { recursive: true });
            await writeFile(
                join(root, 'src/icon.svg'),
                '<svg width="10px" height="20"></svg>'
            );
            await writeFile(
                join(root, 'src/viewbox.svg'),
                '<svg viewBox="0 0 30 40"></svg>'
            );
            await writeFile(join(root, 'src/pixel.gif'), createGifBuffer(4, 5));
            await writeFile(
                join(root, 'src/photo.jpg'),
                createJpegBuffer(6, 7)
            );
            await writeFile(
                join(root, 'src/image.webp'),
                createWebpBuffer(8, 9)
            );
            await writeFile(
                join(root, 'src/unknown.avif'),
                Buffer.from([1, 2])
            );

            const images = new Map(
                (await listViteAssets(root)).map((asset) => [
                    asset.relativePath,
                    asset.image
                ])
            );

            expect(images.get('src/icon.svg')).toEqual({
                height: 20,
                type: 'svg',
                width: 10
            });
            expect(images.get('src/viewbox.svg')).toEqual({
                height: 40,
                type: 'svg',
                width: 30
            });
            expect(images.get('src/pixel.gif')).toEqual({
                height: 5,
                type: 'gif',
                width: 4
            });
            expect(images.get('src/photo.jpg')).toEqual({
                height: 7,
                type: 'jpeg',
                width: 6
            });
            expect(images.get('src/image.webp')).toEqual({
                height: 9,
                type: 'webp',
                width: 8
            });
            expect(images.get('src/unknown.avif')).toEqual({ type: 'unknown' });
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('classifies video assets and reads text assets with truncation', async () => {
        const root = await createAssetFixture();

        try {
            await writeFile(join(root, 'src/movie.mp4'), Buffer.from([1, 2]));

            expect(classifyAsset(join(root, 'src/movie.mp4'))).toBe('video');

            const result = await readViteAssetText(
                root,
                join(root, 'src/readme.txt'),
                { maxTextBytes: 5 }
            );

            expect(result).toMatchObject({
                content: 'hello',
                encoding: 'utf8',
                kind: 'text',
                truncated: true
            });
            await expect(
                readViteAssetText(root, join(root, '..', 'outside.txt'))
            ).rejects.toThrow('outside the Vite project root');
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('responds to Vite asset RPC list/read requests', async () => {
        const root = await createAssetFixture();
        const posted: ViteTransportPayload[] = [];
        const channel = {
            on: jest.fn(),
            post: (payload: ViteTransportPayload) => {
                posted.push(payload);
            }
        };

        try {
            await handleViteAssetRpcPayload(channel, root, {
                requestId: 'assets:list:1',
                type: VITE_ASSET_RPC_LIST_REQUEST
            });
            await handleViteAssetRpcPayload(channel, root, {
                filePath: join(root, 'src/readme.txt'),
                maxBytes: 5,
                requestId: 'assets:read:1',
                type: VITE_ASSET_RPC_READ_REQUEST
            });

            expect(posted[0]).toMatchObject({
                requestId: 'assets:list:1',
                type: VITE_ASSET_RPC_LIST_RESPONSE
            });
            expect(posted[1]).toMatchObject({
                requestId: 'assets:read:1',
                result: {
                    content: 'hello',
                    truncated: true
                },
                type: VITE_ASSET_RPC_READ_RESPONSE
            });
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('ignores unknown asset RPC payloads and reports read errors', async () => {
        const root = await createAssetFixture();
        const posted: ViteTransportPayload[] = [];
        const channel = {
            on: jest.fn(),
            post: (payload: ViteTransportPayload) => {
                posted.push(payload);
            }
        };

        try {
            await handleViteAssetRpcPayload(channel, root, null);
            await handleViteAssetRpcPayload(channel, root, { type: 'unknown' });
            await handleViteAssetRpcPayload(channel, root, {
                filePath: join(root, '..', 'outside.txt'),
                requestId: 'assets:read:error',
                type: VITE_ASSET_RPC_READ_REQUEST
            });

            expect(posted).toEqual([
                expect.objectContaining({
                    error: expect.stringContaining(
                        'outside the Vite project root'
                    ),
                    requestId: 'assets:read:error',
                    type: VITE_ASSET_RPC_READ_RESPONSE
                })
            ]);
        } finally {
            await rm(root, { force: true, recursive: true });
        }
    });

    it('emits debounced asset update events on watcher changes', () => {
        jest.useFakeTimers();
        const posted: ViteTransportPayload[] = [];
        const watcherHandlers = new Map<string, () => void>();

        try {
            installViteAssetRpc(
                {
                    config: { root: '/project' },
                    watcher: {
                        on: jest.fn((event: string, handler: () => void) => {
                            watcherHandlers.set(event, handler);
                        })
                    }
                } as never,
                {
                    on: jest.fn(),
                    post: (payload: ViteTransportPayload) => {
                        posted.push(payload);
                    }
                },
                { updateDebounceMs: 25 }
            );

            watcherHandlers.get('add')?.();
            watcherHandlers.get('change')?.();
            jest.advanceTimersByTime(24);
            expect(posted).toEqual([]);

            jest.advanceTimersByTime(1);
            expect(posted).toEqual([{ type: VITE_ASSET_UPDATE_EVENT }]);
        } finally {
            jest.useRealTimers();
        }
    });

    it('allows asset RPC registration to be disabled', () => {
        const on = jest.fn();
        const plugin = reactDevtools({
            assets: false,
            graph: false,
            clientDir: '/tmp/client'
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use: jest.fn()
            },
            ws: {
                on,
                send: jest.fn()
            }
        } as never);

        expect(on).not.toHaveBeenCalledWith(
            VITE_TRANSPORT_EVENT,
            expect.any(Function)
        );
    });

    it('normalizes the Vite module graph into modules and import edges', () => {
        const { root, server } = createModuleGraphFixture();
        const graph = getViteModuleGraphSnapshot(server as never, { root });

        expect(
            graph.modules.map((moduleNode) => moduleNode.relativePath)
        ).toEqual([
            'index.html',
            'public/logo.svg',
            'src/App.tsx',
            'src/Button.jsx',
            'src/data.json',
            'src/theme.css'
        ]);
        expect(
            graph.modules.map((moduleNode) => [
                moduleNode.relativePath,
                moduleNode.kind
            ])
        ).toEqual([
            ['index.html', 'html'],
            ['public/logo.svg', 'asset'],
            ['src/App.tsx', 'tsx'],
            ['src/Button.jsx', 'jsx'],
            ['src/data.json', 'json'],
            ['src/theme.css', 'css']
        ]);
        expect(graph.edges).toEqual([
            {
                from: '/project/index.html',
                kind: 'import',
                to: '/project/src/App.tsx'
            },
            {
                from: '/project/src/App.tsx',
                kind: 'import',
                to: '/project/public/logo.svg'
            },
            {
                from: '/project/src/App.tsx',
                kind: 'import',
                to: '/project/src/Button.jsx'
            },
            {
                from: '/project/src/App.tsx',
                kind: 'import',
                to: '/project/src/data.json'
            },
            {
                from: '/project/src/App.tsx',
                kind: 'import',
                to: '/project/src/theme.css'
            }
        ]);
    });

    it('supports Vite module graph dependency and importer traversal', () => {
        const { root, server } = createModuleGraphFixture();
        const dependencies = getViteModuleGraphSnapshot(
            server as never,
            { root },
            {
                depth: 1,
                direction: 'dependencies',
                rootId: '/project/src/App.tsx'
            }
        );
        const importers = getViteModuleGraphSnapshot(
            server as never,
            { root },
            {
                direction: 'importers',
                rootId: '/project/src/Button.jsx'
            }
        );

        expect(dependencies.modules.map((moduleNode) => moduleNode.id)).toEqual(
            [
                '/project/public/logo.svg',
                '/project/src/App.tsx',
                '/project/src/Button.jsx',
                '/project/src/data.json',
                '/project/src/theme.css'
            ]
        );
        expect(importers.modules.map((moduleNode) => moduleNode.id)).toEqual([
            '/project/index.html',
            '/project/src/App.tsx',
            '/project/src/Button.jsx'
        ]);
    });

    it('classifies Vite graph modules by source and asset extension', () => {
        expect(classifyViteGraphModule('/src/main.js')).toBe('js');
        expect(classifyViteGraphModule('/src/main.ts')).toBe('ts');
        expect(classifyViteGraphModule('/src/App.tsx')).toBe('tsx');
        expect(classifyViteGraphModule('/src/App.jsx')).toBe('jsx');
        expect(classifyViteGraphModule('/src/theme.css?inline')).toBe('css');
        expect(classifyViteGraphModule('/index.html')).toBe('html');
        expect(classifyViteGraphModule('/src/data.json')).toBe('json');
        expect(classifyViteGraphModule('/src/logo.png')).toBe('asset');
        expect(classifyViteGraphModule('/src/module.wasm')).toBe('other');
    });

    it('responds to Vite module graph RPC requests and errors', () => {
        const { root, server } = createModuleGraphFixture();
        const posted: ViteTransportPayload[] = [];
        const channel = {
            on: jest.fn(),
            post: (payload: ViteTransportPayload) => {
                posted.push(payload);
            }
        };

        handleViteGraphRpcPayload(channel, server as never, {
            requestId: 'graph:get:1',
            rootId: '/project/src/App.tsx',
            type: VITE_GRAPH_RPC_GET_REQUEST
        });
        handleViteGraphRpcPayload(channel, server as never, {
            requestId: 'graph:get:error',
            rootId: '/project/src/Missing.tsx',
            type: VITE_GRAPH_RPC_GET_REQUEST
        });
        handleViteGraphRpcPayload(channel, server as never, null, { root });
        handleViteGraphRpcPayload(channel, server as never, {
            type: 'unknown'
        });

        expect(posted[0]).toMatchObject({
            graph: {
                edges: expect.any(Array),
                modules: expect.any(Array)
            },
            requestId: 'graph:get:1',
            type: VITE_GRAPH_RPC_GET_RESPONSE
        });
        expect(posted[1]).toMatchObject({
            error: expect.stringContaining('was not found'),
            requestId: 'graph:get:error',
            type: VITE_GRAPH_RPC_GET_RESPONSE
        });
        expect(posted).toHaveLength(2);
    });

    it('emits debounced graph update events on watcher changes', () => {
        jest.useFakeTimers();
        const posted: ViteTransportPayload[] = [];
        const watcherHandlers = new Map<string, () => void>();

        try {
            installViteGraphRpc(
                {
                    moduleGraph: {
                        idToModuleMap: new Map(),
                        urlToModuleMap: new Map()
                    },
                    watcher: {
                        on: jest.fn((event: string, handler: () => void) => {
                            watcherHandlers.set(event, handler);
                        })
                    }
                } as never,
                {
                    on: jest.fn(),
                    post: (payload: ViteTransportPayload) => {
                        posted.push(payload);
                    }
                },
                { updateDebounceMs: 25 }
            );

            watcherHandlers.get('add')?.();
            watcherHandlers.get('unlink')?.();
            jest.advanceTimersByTime(24);
            expect(posted).toEqual([]);

            jest.advanceTimersByTime(1);
            expect(posted).toEqual([{ type: VITE_GRAPH_UPDATE_EVENT }]);
        } finally {
            jest.useRealTimers();
        }
    });

    it('allows graph RPC registration to be disabled independently', () => {
        const on = jest.fn();
        const plugin = reactDevtools({
            clientDir: '/tmp/client',
            graph: false
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            config: { root: '/project' },
            middlewares: {
                use: jest.fn()
            },
            watcher: {
                on: jest.fn()
            },
            ws: {
                on,
                send: jest.fn()
            }
        } as never);

        expect(on).toHaveBeenCalledTimes(1);
    });

    it('wires a namespaced Vite websocket transport channel', () => {
        const send = jest.fn();
        const on = jest.fn();
        const onViteTransport = jest.fn();
        const plugin = reactDevtools({
            clientDir: '/tmp/client',
            onViteTransport
        });
        const configureServer = plugin.configureServer as (
            server: never
        ) => void;

        configureServer({
            middlewares: {
                use: jest.fn()
            },
            ws: {
                on,
                send
            }
        } as never);

        expect(onViteTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                on: expect.any(Function),
                post: expect.any(Function)
            })
        );

        const channel = onViteTransport.mock.calls[0][0];
        channel.post({ type: 'tree:get', payload: { rootId: 1 } });

        expect(send).toHaveBeenCalledWith(
            VITE_TRANSPORT_EVENT,
            JSON.stringify({ type: 'tree:get', payload: { rootId: 1 } })
        );
    });

    it('uses the Vite hot server transport when available', () => {
        const hotSend = jest.fn();
        const wsSend = jest.fn();
        const channel = createViteTransportChannel({
            hot: {
                on: jest.fn(),
                send: hotSend
            },
            ws: {
                on: jest.fn(),
                send: wsSend
            }
        });

        channel.post({ type: 'ping' });

        expect(hotSend).toHaveBeenCalledWith(
            VITE_TRANSPORT_EVENT,
            JSON.stringify({ type: 'ping' })
        );
        expect(wsSend).not.toHaveBeenCalled();
    });

    it('receives transport messages on only the React DevTools event', () => {
        const handlers = new Map<string, (payload: string) => void>();
        const received: unknown[] = [];
        const channel = createViteTransportChannel({
            ws: {
                on: jest.fn(
                    (event: string, handler: (payload: string) => void) => {
                        handlers.set(event, handler);
                    }
                ),
                send: jest.fn()
            }
        });

        channel.on((payload) => {
            received.push(payload);
        });
        handlers.get(VITE_TRANSPORT_EVENT)?.(
            JSON.stringify({ type: 'tree:response', payload: [] })
        );
        handlers.get('vite:beforeUpdate')?.(JSON.stringify({ type: 'hmr' }));

        expect(received).toEqual([{ type: 'tree:response', payload: [] }]);
        expect(handlers.has('vite:beforeUpdate')).toBe(false);
    });
});
