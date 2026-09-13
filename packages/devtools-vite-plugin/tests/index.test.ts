import { Writable } from 'node:stream';
import { join } from 'node:path';
import {
    DEFAULT_CLIENT_BASE_PATH,
    DEFAULT_OVERLAY_BASE_PATH,
    DEFAULT_OVERLAY_SCRIPT_PATH,
    createOverlayScriptTag,
    getDefaultClientDir,
    getDefaultOverlayDir,
    injectOverlayScript,
    normalizeServePath,
    reactDevtools
} from '../src';

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
            `<script type="module" src="${DEFAULT_OVERLAY_SCRIPT_PATH}"></script>`
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

        expect(use).toHaveBeenNthCalledWith(
            1,
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

        expect(use).toHaveBeenNthCalledWith(
            2,
            DEFAULT_OVERLAY_BASE_PATH,
            expect.any(Function)
        );
    });

    it('normalizes custom serve paths', () => {
        expect(normalizeServePath('__devtools__')).toBe('/__devtools__/');
        expect(normalizeServePath('/__devtools__')).toBe('/__devtools__/');
        expect(normalizeServePath('/__devtools__/')).toBe('/__devtools__/');
    });

    it('returns the standalone client index through the devtools middleware', async () => {
        const use = createMockViteServer(
            join(process.cwd(), 'tests/fixtures/client')
        );
        const middleware = use.mock.calls[0][1];

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

    it('returns client assets through the devtools middleware', async () => {
        const use = createMockViteServer(
            join(process.cwd(), 'tests/fixtures/client')
        );
        const middleware = use.mock.calls[0][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            '/assets/client.js'
        );

        expect(missed).toBe(false);
        expect(response.statusCode).toBe(200);
        expect(response.getHeader('content-type')).toBe('text/javascript');
        expect(response.body).toContain('reactDevtoolsClient');
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

        const middleware = use.mock.calls[1][1];

        const { missed, response } = await requestMiddleware(
            middleware,
            '/devtools-overlay.js'
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
            code: `import '${DEFAULT_OVERLAY_SCRIPT_PATH}';\nconsole.log("app");`,
            map: null
        });
        expect(transform('console.log("app");', '/project/src/other.tsx')).toBe(
            undefined
        );
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
            `<script type="module" src="${DEFAULT_OVERLAY_SCRIPT_PATH}"></script>`
        );
        expect(injectOverlayScript(injected)).toBe(injected);
        expect(injectOverlayScript('<main></main>')).toContain('<main></main>');
    });

    it('defaults the future client bundle location under node_modules', () => {
        expect(getDefaultClientDir()).toContain(
            'node_modules/@devtools/devtools-client/dist'
        );
        expect(getDefaultOverlayDir()).toContain(
            'node_modules/@devtools/devtools-overlay/dist'
        );
    });
});
