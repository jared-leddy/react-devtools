import { createReadStream, statSync } from 'node:fs';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import type { SourceMapInput } from 'rollup';
import type { Plugin, ViteDevServer } from 'vite';
import {
    createViteTransportChannel,
    type ViteTransportChannel
} from './viteTransport.js';
import {
    shouldTransformSourceMetadata,
    transformReactSourceMetadata,
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
}

export const DEFAULT_CLIENT_BASE_PATH = '/__react-devtools-client__/';
export const DEFAULT_OVERLAY_BASE_PATH = '/__react-devtools-overlay__/';
export const DEFAULT_OVERLAY_SCRIPT_PATH =
    '/__react-devtools-overlay__/devtools-overlay.js';

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
    const servePath = normalizeServePath(
        options.clientBasePath ?? DEFAULT_CLIENT_BASE_PATH
    );

    server.middlewares.use(
        servePath,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(clientDir, { single: true }),
            { requirePrefix: false }
        )
    );
    prependMiddleware(
        server,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(clientDir, { single: true }),
            { requirePrefix: true }
        )
    );
}

function createOverlayMiddleware(
    options: ReactDevtoolsVitePluginOptions,
    server: ViteDevServer
) {
    const overlayDir = options.overlayDir ?? getDefaultOverlayDir();
    const servePath = normalizeServePath(
        options.overlayBasePath ?? DEFAULT_OVERLAY_BASE_PATH
    );

    server.middlewares.use(
        servePath,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(overlayDir),
            { requirePrefix: false }
        )
    );
    prependMiddleware(
        server,
        createMountedStaticMiddleware(
            servePath,
            createStaticFileMiddleware(overlayDir),
            { requirePrefix: true }
        )
    );
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
    options: { single?: boolean } = {}
): StaticMiddleware {
    const normalizedRoot = normalize(rootDir);

    return (request, response, next) => {
        const filePath = getStaticFilePath(normalizedRoot, request.url ?? '/');

        if (filePath) {
            sendStaticFile(request, response, filePath);
            return;
        }

        if (options.single) {
            const fallbackPath = getStaticFilePath(
                normalizedRoot,
                '/index.html'
            );

            if (fallbackPath) {
                sendStaticFile(request, response, fallbackPath);
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
    filePath: string
): void {
    const stats = statSync(filePath);

    response.writeHead(request.method === 'HEAD' ? 204 : 200, {
        'Cache-Control': 'no-cache',
        'Content-Length': stats.size,
        'Content-Type': getContentType(filePath),
        'Last-Modified': stats.mtime.toUTCString()
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

export function createOverlayScriptTag(
    scriptPath = DEFAULT_OVERLAY_SCRIPT_PATH
) {
    return `<script type="module" src="${scriptPath}"></script>`;
}

export function injectOverlayScript(
    html: string,
    scriptPath = DEFAULT_OVERLAY_SCRIPT_PATH
) {
    const scriptTag = createOverlayScriptTag(scriptPath);

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
    id: string
) {
    if (!options.appendTo || !matchesAppendTarget(options.appendTo, id)) {
        return undefined;
    }

    const scriptPath = options.overlayScriptPath ?? DEFAULT_OVERLAY_SCRIPT_PATH;
    return {
        code: `import '${scriptPath}';\n${code}`,
        map: null
    };
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
    return {
        name: 'vite-plugin-react-devtools',
        apply: 'serve',
        enforce: 'pre',
        configureServer(server) {
            createClientMiddleware(options, server);
            createOverlayMiddleware(options, server);
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

            const overlayTransform = createOverlayImport(options, code, id);
            const sourceCode = overlayTransform?.code ?? code;
            const sourceTransform = shouldTransformSourceMetadata(
                id,
                options.sourceMetadata
            )
                ? transformReactSourceMetadata(
                      sourceCode,
                      id,
                      options.sourceMetadata || undefined
                  )
                : undefined;

            return composeTransformResults(overlayTransform, sourceTransform);
        },
        transformIndexHtml(html) {
            if (options.appendTo) {
                return html;
            }

            return injectOverlayScript(html, options.overlayScriptPath);
        }
    };
}

export default reactDevtools;
