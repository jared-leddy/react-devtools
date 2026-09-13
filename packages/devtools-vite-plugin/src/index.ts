import { resolve } from 'node:path';
import sirv from 'sirv';
import type { IndexHtmlTransformResult, Plugin, ViteDevServer } from 'vite';

export interface ReactDevtoolsVitePluginOptions {
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
     * URL for the overlay bundle that mounts the floating toggle.
     */
    overlayScriptPath?: string;
}

export const DEFAULT_CLIENT_BASE_PATH = '/__react-devtools-client__/';
export const DEFAULT_OVERLAY_SCRIPT_PATH = '/@react-devtools/overlay';

export function getDefaultClientDir() {
    return resolve(
        process.cwd(),
        'node_modules/@devtools/devtools-client/dist'
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

function createOverlayInjection(
    options: ReactDevtoolsVitePluginOptions
): IndexHtmlTransformResult {
    return [
        {
            tag: 'script',
            injectTo: 'head-prepend',
            attrs: {
                type: 'module',
                src: options.overlayScriptPath ?? DEFAULT_OVERLAY_SCRIPT_PATH
            }
        }
    ];
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
        },
        transformIndexHtml() {
            return createOverlayInjection(options);
        }
    };
}

export default reactDevtools;
