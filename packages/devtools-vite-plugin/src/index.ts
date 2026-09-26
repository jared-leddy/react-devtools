import { spawn } from 'node:child_process';
import { createReadStream, statSync } from 'node:fs';
import type {
    IncomingHttpHeaders,
    OutgoingHttpHeaders,
    ServerResponse
} from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import type { SourceMapInput } from 'rollup';
import type { Plugin, ViteDevServer } from 'vite';
import {
    createViteTransportChannel,
    type ViteTransportChannel
} from './viteTransport.js';
import {
    shouldTransformReactMetadata,
    transformReactMetadata,
    type ComponentInspectorOptions,
    type SourceMetadataOptions
} from './sourceMetadata.js';
import {
    installViteAssetRpc,
    type ViteAssetExplorerOptions
} from './assets.js';
import { installViteGraphRpc, type ViteGraphExplorerOptions } from './graph.js';
export * from './sourceMetadata.js';
export * from './assets.js';
export * from './graph.js';

export interface ReactDevtoolsVitePluginOptions {
    /**
     * Append the overlay import to a module instead of injecting index.html.
     * Useful for apps that do not use an HTML file as their entry.
     */
    appendTo?: RegExp | string;
    /**
     * Path to the built devtools-client standalone bundle.
     * The default points at the package-local future client directory.
     */
    clientDir?: string;
    /**
     * URL where the standalone client is served by Vite middleware.
     */
    clientBasePath?: string;
    /**
     * Prints the standalone devtools URL after the Vite dev server starts.
     */
    printDevtoolsUrl?: boolean;
    /**
     * Path to the built devtools-overlay bundle.
     */
    overlayDir?: string;
    /**
     * URL where the overlay bundle directory is served by Vite middleware.
     */
    overlayBasePath?: string;
    /**
     * URL for the overlay bundle that mounts the floating toggle.
     */
    overlayScriptPath?: string;
    /**
     * Receives the namespaced Vite websocket transport channel.
     */
    onViteTransport?: (channel: ViteTransportChannel) => void;
    /**
     * Enables project asset explorer RPC over the Vite transport.
     */
    assets?: false | ViteAssetExplorerOptions;
    /**
     * Enables Vite module graph RPC over the Vite transport.
     */
    graph?: false | ViteGraphExplorerOptions;
    /**
     * Enables dev-only JSX source metadata annotations. Set false to opt out.
     */
    sourceMetadata?: false | SourceMetadataOptions;
    /**
     * Enables click-to-inspect component metadata annotations. Set false to opt out.
     */
    componentInspector?: false | ComponentInspectorOptions;
    /**
     * Enables the same-origin open-in-editor endpoint used by the client.
     */
    openInEditor?: false | OpenInEditorOptions;
}

export interface OpenInEditorOptions {
    /**
     * Editor executable. Defaults to REACT_EDITOR, VISUAL, EDITOR, or code.
     */
    command?: string;
    /**
     * Optional argument template. Supports {file}, {line}, {column}, and
     * {location}. When omitted, VS Code-style editors receive -g {location}.
     */
    args?: string[];
    /**
     * Internal launch hook used by tests and embedders that want full control.
     */
    launch?: OpenInEditorLauncher;
}

export const DEFAULT_CLIENT_BASE_PATH = '/__devtools__/';
export const DEFAULT_OVERLAY_BASE_PATH = '/__react-devtools-overlay__/';
export const DEFAULT_OVERLAY_SCRIPT_PATH =
    '/__react-devtools-overlay__/devtools-overlay.js';
export const OPEN_IN_EDITOR_PATH = '/__open-in-editor';
export const DEVTOOLS_TOGGLE_SHORTCUT_HINT = 'Option+Shift+D';

export type OpenInEditorLauncher = (
    command: string,
    args: string[]
) => void | Promise<void>;

interface CodeTransformResult {
    code: string;
    map?: null | SourceMapInput;
}

const requireFromProject = createRequire(
    resolve(process.cwd(), 'package.json')
);
const PREPEND_MIDDLEWARE_MARK = Symbol('react-devtools.prependMiddleware');

type MarkedStaticMiddleware = StaticMiddleware & {
    [PREPEND_MIDDLEWARE_MARK]?: true;
};

export function getDefaultClientDir() {
    return resolve(
        dirname(requireFromProject.resolve('@devtools/client/style.css')),
        '..',
        'standalone'
    );
}

export function getDefaultOverlayDir() {
    return dirname(requireFromProject.resolve('@devtools/devtools-overlay'));
}

export function normalizeServePath(path: string) {
    const prefixedPath = path.startsWith('/') ? path : `/${path}`;
    return prefixedPath.endsWith('/') ? prefixedPath : `${prefixedPath}/`;
}

function createClientMiddleware(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
) {
    const clientDir = options.clientDir ?? getDefaultClientDir();
    const servePath = getDevtoolsClientBasePath(options, server);
    const headers = getServerHeaders(server);

    server.middlewares.use(
        servePath,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(clientDir, { headers, single: true }),
            { requirePrefix: false }
        )
    );
    prependMiddleware(
        server,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(clientDir, { headers, single: true }),
            { requirePrefix: true }
        )
    );
}

function createOverlayMiddleware(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
) {
    const overlayDir = options.overlayDir ?? getDefaultOverlayDir();
    const servePath = getDevtoolsOverlayBasePath(options, server);
    const headers = getServerHeaders(server);

    server.middlewares.use(
        servePath,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(overlayDir, { headers }),
            { requirePrefix: false }
        )
    );
    prependMiddleware(
        server,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(overlayDir, { headers }),
            { requirePrefix: true }
        )
    );
}

function createOpenInEditorMiddleware(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
) {
    if (options.openInEditor === false) {
        return;
    }

    const rootDir = normalize(server.config?.root ?? process.cwd());
    const editorOptions = options.openInEditor || {};

    prependMiddleware(server, (request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://devtools.local');

        if (requestUrl.pathname !== OPEN_IN_EDITOR_PATH) {
            next?.();
            return;
        }

        if (request.method && !['GET', 'HEAD'].includes(request.method)) {
            sendJsonResponse(response, 405, {
                error: 'Method not allowed.'
            });
            return;
        }

        handleOpenInEditorRequest(requestUrl, response, rootDir, editorOptions);
    });
}

interface StaticRequest {
    headers: IncomingHttpHeaders;
    method?: string;
    url?: string;
}

type StaticMiddleware = (
    request: StaticRequest,
    response: ServerResponse,
    next?: () => void
) => void;

function createMountedStaticMiddleware(
    servePath: string,
    middleware: StaticMiddleware,
    options: { requirePrefix: boolean }
): StaticMiddleware {
    return (request, response, next) => {
        const originalUrl = request.url;

        if (originalUrl?.startsWith(servePath)) {
            request.url = `/${originalUrl.slice(servePath.length)}`;
            delete (request as typeof request & { _parsedUrl?: unknown })
                ._parsedUrl;
        } else if (options.requirePrefix) {
            next?.();
            return;
        }

        middleware(request, response, () => {
            request.url = originalUrl;
            next?.();
        });
    };
}

function prependMiddleware(
    server: ViteDevServer,
    middleware: StaticMiddleware
): void {
    (middleware as MarkedStaticMiddleware)[PREPEND_MIDDLEWARE_MARK] = true;
    server.middlewares.use(middleware);
}

function promotePrependedMiddlewares(server: ViteDevServer): void {
    const stack = getMiddlewareStack(server);

    if (!stack.length) {
        return;
    }

    const promoted = stack.filter(isMarkedMiddlewareLayer);
    const remaining = stack.filter((layer) => !isMarkedMiddlewareLayer(layer));

    stack.splice(0, stack.length, ...promoted, ...remaining);
}

function getMiddlewareStack(server: ViteDevServer): unknown[] {
    return (
        (
            server.middlewares as typeof server.middlewares & {
                stack?: unknown[];
            }
        ).stack ?? []
    );
}

function isMarkedMiddlewareLayer(layer: unknown): boolean {
    return Boolean(
        layer &&
        typeof layer === 'object' &&
        'handle' in layer &&
        (layer as { handle?: MarkedStaticMiddleware }).handle?.[
            PREPEND_MIDDLEWARE_MARK
        ]
    );
}

function createStaticFileMiddleware(
    rootDir: string,
    options: { headers?: OutgoingHttpHeaders; single?: boolean } = {}
): StaticMiddleware {
    const normalizedRoot = normalize(rootDir);

    return (request, response, next) => {
        const filePath = getStaticFilePath(normalizedRoot, request.url ?? '/');

        if (filePath) {
            sendStaticFile(request, response, filePath, options.headers);
            return;
        }

        if (options.single) {
            const fallbackPath = getStaticFilePath(
                normalizedRoot,
                '/index.html'
            );

            if (fallbackPath) {
                sendStaticFile(
                    request,
                    response,
                    fallbackPath,
                    options.headers
                );
                return;
            }
        }

        next?.();
    };
}

function getStaticFilePath(rootDir: string, url: string): string | undefined {
    const pathname = decodeURIComponent(
        new URL(url, 'http://devtools.local').pathname
    );
    const relativePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = normalize(join(rootDir, relativePath));

    if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${sep}`)) {
        return undefined;
    }

    try {
        const stats = statSync(filePath);

        return stats.isFile() ? filePath : undefined;
    } catch {
        return undefined;
    }
}

function sendStaticFile(
    request: StaticRequest,
    response: ServerResponse,
    filePath: string,
    headers: OutgoingHttpHeaders = {}
): void {
    const stats = statSync(filePath);

    response.writeHead(request.method === 'HEAD' ? 204 : 200, {
        'Cache-Control': 'no-cache',
        'Content-Length': stats.size,
        'Content-Type': getContentType(filePath),
        'Last-Modified': stats.mtime.toUTCString(),
        ...headers
    });

    if (request.method === 'HEAD') {
        response.end();
        return;
    }

    createReadStream(filePath).pipe(response);
}

function getContentType(filePath: string): string {
    switch (extname(filePath)) {
        case '.css':
            return 'text/css';
        case '.html':
            return 'text/html;charset=utf-8';
        case '.js':
            return 'text/javascript';
        case '.json':
            return 'application/json';
        case '.svg':
            return 'image/svg+xml';
        default:
            return 'application/octet-stream';
    }
}

function handleOpenInEditorRequest(
    requestUrl: URL,
    response: ServerResponse,
    rootDir: string,
    options: OpenInEditorOptions
): void {
    const file = requestUrl.searchParams.get('file');

    if (!file) {
        sendJsonResponse(response, 400, {
            error: 'Missing required file query parameter.'
        });
        return;
    }

    const filePath = resolveOpenInEditorFile(rootDir, file);

    if (!filePath) {
        sendJsonResponse(response, 403, {
            error: 'File must be inside the Vite project root.'
        });
        return;
    }

    const line = parsePositiveInteger(requestUrl.searchParams.get('line'));
    const column = parsePositiveInteger(requestUrl.searchParams.get('column'));
    const command = getEditorCommand(options);
    const args = getEditorArgs(command, options, filePath, line, column);

    try {
        const result = options.launch?.(command, args);

        if (result && typeof result === 'object' && 'then' in result) {
            void result.catch((error: unknown) => {
                console.error('[react-devtools] Failed to open editor:', error);
            });
        } else if (!options.launch) {
            launchEditorProcess(command, args);
        }

        sendJsonResponse(response, 202, {
            args,
            command,
            file: filePath,
            ok: true
        });
    } catch (error) {
        sendJsonResponse(response, 500, {
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to open editor.'
        });
    }
}

function resolveOpenInEditorFile(
    rootDir: string,
    file: string
): string | undefined {
    const filePath = normalize(resolve(rootDir, file));

    if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${sep}`)) {
        return undefined;
    }

    return filePath;
}

function parsePositiveInteger(value: string | null): number | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getEditorCommand(options: OpenInEditorOptions): string {
    return (
        options.command ||
        process.env.REACT_EDITOR ||
        process.env.VISUAL ||
        process.env.EDITOR ||
        'code'
    );
}

function getEditorArgs(
    command: string,
    options: OpenInEditorOptions,
    filePath: string,
    line?: number,
    column?: number
): string[] {
    const location = [filePath, line, column].filter(Boolean).join(':');
    const templateArgs =
        options.args ??
        (isCodeEditorCommand(command) ? ['-g', '{location}'] : ['{location}']);

    return templateArgs.map((arg) =>
        arg
            .replaceAll('{file}', filePath)
            .replaceAll('{line}', line?.toString() ?? '')
            .replaceAll('{column}', column?.toString() ?? '')
            .replaceAll('{location}', location)
    );
}

function isCodeEditorCommand(command: string): boolean {
    const executable = command.split(/[\\/]/).at(-1)?.toLowerCase() ?? command;

    return ['code', 'code-insiders', 'codium'].includes(executable);
}

function launchEditorProcess(command: string, args: string[]): void {
    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
    });

    child.on('error', (error) => {
        console.error('[react-devtools] Failed to open editor:', error);
    });
    child.unref();
}

function sendJsonResponse(
    response: ServerResponse,
    statusCode: number,
    payload: Record<string, unknown>
): void {
    const body = JSON.stringify(payload);

    response.writeHead(statusCode, {
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json;charset=utf-8'
    });
    response.end(body);
}

export function createOverlayScriptTag(
    scriptPath = DEFAULT_OVERLAY_SCRIPT_PATH,
    clientUrl = DEFAULT_CLIENT_BASE_PATH
) {
    return `<script type="module" src="${scriptPath}" data-react-devtools-client-url="${clientUrl}" data-react-devtools-separate-window-url="${clientUrl}"></script>`;
}

export function injectOverlayScript(
    html: string,
    scriptPath = DEFAULT_OVERLAY_SCRIPT_PATH,
    clientUrl = DEFAULT_CLIENT_BASE_PATH
) {
    const scriptTag = createOverlayScriptTag(scriptPath, clientUrl);

    if (html.includes(scriptTag)) {
        return html;
    }

    if (html.includes('<head>')) {
        return html.replace('<head>', `<head>\n        ${scriptTag}`);
    }

    return `${scriptTag}\n${html}`;
}

function matchesAppendTarget(appendTo: RegExp | string, id: string) {
    const [filename] = id.split('?', 2);

    return typeof appendTo === 'string'
        ? filename.endsWith(appendTo)
        : appendTo.test(filename);
}

function createOverlayImport(
    options: ReactDevtoolsVitePluginOptions,
    code: string,
    id: string,
    server: ViteDevServer | undefined
) {
    if (!options.appendTo || !matchesAppendTarget(options.appendTo, id)) {
        return undefined;
    }

    const clientUrl = getDevtoolsClientBasePath(options, server);
    const scriptPath = getDevtoolsOverlayScriptPath(options, server);
    return {
        code: `window.__REACT_DEVTOOLS_OVERLAY_CONFIG__ = { clientUrl: ${JSON.stringify(clientUrl)}, separateWindowUrl: ${JSON.stringify(clientUrl)} };\nimport '${scriptPath}';\n${code}`,
        map: null
    };
}

export function getDevtoolsClientBasePath(
    options: ReactDevtoolsVitePluginOptions = {},
    server?: ViteDevServer
): string {
    if (options.clientBasePath) {
        return normalizeServePath(options.clientBasePath);
    }

    return joinViteBasePath(server?.config?.base, DEFAULT_CLIENT_BASE_PATH);
}

export function getDevtoolsOverlayBasePath(
    options: ReactDevtoolsVitePluginOptions = {},
    server?: ViteDevServer
): string {
    if (options.overlayBasePath) {
        return normalizeServePath(options.overlayBasePath);
    }

    return joinViteBasePath(server?.config?.base, DEFAULT_OVERLAY_BASE_PATH);
}

export function getDevtoolsOverlayScriptPath(
    options: ReactDevtoolsVitePluginOptions = {},
    server?: ViteDevServer
): string {
    if (options.overlayScriptPath) {
        return options.overlayScriptPath;
    }

    return `${getDevtoolsOverlayBasePath(options, server)}devtools-overlay.js`;
}

export function resolveDevtoolsUrls(
    server: ViteDevServer,
    options: ReactDevtoolsVitePluginOptions = {}
): string[] {
    const appUrls = [
        ...(server.resolvedUrls?.local ?? []),
        ...(server.resolvedUrls?.network ?? [])
    ];
    const clientBasePath = getDevtoolsClientBasePath(options, server);

    return appUrls.map((appUrl) => new URL(clientBasePath, appUrl).toString());
}

function installDevtoolsUrlPrinter(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
): void {
    if (options.printDevtoolsUrl === false || !server.httpServer) {
        return;
    }

    server.httpServer.once('listening', () => {
        setTimeout(() => {
            printDevtoolsUrls(options, server);
        }, 0);
    });
}

function printDevtoolsUrls(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
): void {
    const urls = resolveDevtoolsUrls(server, options);

    if (!urls.length) {
        return;
    }

    server.config.logger.info(`React DevTools: ${urls[0]}`);
    server.config.logger.info(
        `React DevTools shortcut: ${DEVTOOLS_TOGGLE_SHORTCUT_HINT}`
    );
}

function joinViteBasePath(base: string | undefined, path: string): string {
    const suffix = path.replace(/^\/+/, '');
    const basePath = normalizeViteBasePath(base);

    return normalizeServePath(`${basePath}${suffix}`);
}

function normalizeViteBasePath(base: string | undefined): string {
    if (!base || base === './') {
        return '/';
    }

    try {
        return normalizeServePath(new URL(base).pathname);
    } catch {
        return normalizeServePath(base);
    }
}

function getServerHeaders(server: ViteDevServer): OutgoingHttpHeaders {
    return server.config?.server?.headers ?? {};
}

function composeTransformResults(
    first: CodeTransformResult | undefined,
    second: CodeTransformResult | undefined
): CodeTransformResult | undefined {
    if (!first) {
        return second;
    }

    if (!second) {
        return first;
    }

    return {
        code: second.code,
        map: second.map ?? first.map
    };
}

export function reactDevtools(
    options: ReactDevtoolsVitePluginOptions = {}
): Plugin {
    let viteServer: ViteDevServer | undefined;

    return {
        name: 'vite-plugin-react-devtools',
        apply: 'serve',
        enforce: 'pre',
        configureServer(server) {
            viteServer = server;
            createOpenInEditorMiddleware(options, server);
            createClientMiddleware(options, server);
            createOverlayMiddleware(options, server);
            installDevtoolsUrlPrinter(options, server);
            const viteTransportChannel = createViteTransportChannel(server);
            if (options.assets !== false) {
                installViteAssetRpc(
                    server,
                    viteTransportChannel,
                    options.assets || undefined
                );
            }
            if (options.graph !== false) {
                installViteGraphRpc(
                    server,
                    viteTransportChannel,
                    options.graph || undefined
                );
            }
            options.onViteTransport?.(viteTransportChannel);

            return () => {
                promotePrependedMiddlewares(server);
            };
        },
        transform(code, id, transformOptions) {
            if (transformOptions?.ssr) {
                return undefined;
            }

            const overlayTransform = createOverlayImport(
                options,
                code,
                id,
                viteServer
            );
            const sourceCode = overlayTransform?.code ?? code;
            const sourceTransform = shouldTransformReactMetadata(id, {
                componentInspector: options.componentInspector,
                sourceMetadata: options.sourceMetadata
            })
                ? transformReactMetadata(sourceCode, id, {
                      componentInspector: options.componentInspector,
                      sourceMetadata: options.sourceMetadata
                  })
                : undefined;

            return composeTransformResults(overlayTransform, sourceTransform);
        },
        transformIndexHtml(html, ctx) {
            if (options.appendTo) {
                return html;
            }

            const clientUrl = getDevtoolsClientBasePath(
                options,
                ctx?.server ?? viteServer
            );
            const overlayScriptPath = getDevtoolsOverlayScriptPath(
                options,
                ctx?.server ?? viteServer
            );

            return injectOverlayScript(html, overlayScriptPath, clientUrl);
        }
    };
}

export default reactDevtools;
