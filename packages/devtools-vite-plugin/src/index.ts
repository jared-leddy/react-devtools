import { resolve } from 'node:path';
import sirv from 'sirv';
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
export * from './sourceMetadata.js';
export * from './assets.js';

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
     * Enables dev-only JSX source metadata annotations. Set false to opt out.
     */
    sourceMetadata?: false | SourceMetadataOptions;
}

export const DEFAULT_CLIENT_BASE_PATH = '/__devtools__/';
export const DEFAULT_OVERLAY_BASE_PATH = '/@react-devtools/overlay/';
export const DEFAULT_OVERLAY_SCRIPT_PATH =
    '/@react-devtools/overlay/devtools-overlay.js';

interface CodeTransformResult {
    code: string;
    map?: null | SourceMapInput;
}

export function getDefaultClientDir() {
    return resolve(
        process.cwd(),
        'node_modules/@devtools/devtools-client/dist'
    );
}

export function getDefaultOverlayDir() {
    return resolve(
        process.cwd(),
        'node_modules/@devtools/devtools-overlay/dist'
    );
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
        sirv(clientDir, {
            dev: true,
            single: true
        })
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
        sirv(overlayDir, {
            dev: true
        })
    );
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
            options.onViteTransport?.(viteTransportChannel);
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
