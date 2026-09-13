import { Writable } from 'node:stream';
import { join } from 'node:path';
import {
    DEFAULT_CLIENT_BASE_PATH,
    DEFAULT_OVERLAY_SCRIPT_PATH,
    getDefaultClientDir,
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
        const result = transformIndexHtml('', {} as never);

        expect(result).toEqual([
            {
                tag: 'script',
                injectTo: 'head-prepend',
                attrs: {
                    type: 'module',
                    src: DEFAULT_OVERLAY_SCRIPT_PATH
                }
            }
        ]);
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

    it('defaults the future client bundle location under node_modules', () => {
        expect(getDefaultClientDir()).toContain(
            'node_modules/@devtools/devtools-client/dist'
        );
    });
});
