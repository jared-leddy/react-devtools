import {
    DEFAULT_CLIENT_BASE_PATH,
    DEFAULT_OVERLAY_SCRIPT_PATH,
    getDefaultClientDir,
    normalizeServePath,
    reactDevtools
} from '../src';

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

    it('defaults the future client bundle location under node_modules', () => {
        expect(getDefaultClientDir()).toContain(
            'node_modules/@devtools/devtools-client/dist'
        );
    });
});
