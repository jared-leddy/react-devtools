import { connectViteClientContext } from '@devtools/kit';
import { initializeStandaloneDelivery } from '../src/delivery';
import { setClientRouteEnvironment } from '../src/routing';
import { setClientRuntimeState } from '../src/runtime';

jest.mock('@devtools/kit', () => ({ connectViteClientContext: jest.fn() }));
jest.mock('../src/routing', () => ({ setClientRouteEnvironment: jest.fn() }));
jest.mock('../src/runtime', () => ({ setClientRuntimeState: jest.fn() }));

describe('standalone delivery bootstrap', () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        globalThis.fetch = fetchMock;
    });
    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    it('connects the served Vite client using the declared project base', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            headers: { get: () => '/nested/' }
        });
        jest.mocked(connectViteClientContext).mockResolvedValue({
            on: jest.fn(),
            send: jest.fn()
        });
        await initializeStandaloneDelivery();
        expect(fetchMock).toHaveBeenCalledWith(window.location.href, {
            method: 'HEAD'
        });
        expect(setClientRouteEnvironment).toHaveBeenCalledWith({
            transport: 'vite'
        });
        expect(connectViteClientContext).toHaveBeenCalledWith({
            base: '/nested/'
        });
        expect(setClientRuntimeState).toHaveBeenNthCalledWith(1, {
            connectionStatus: 'waiting'
        });
        expect(setClientRuntimeState).toHaveBeenLastCalledWith({
            connectionStatus: 'disconnected'
        });
    });

    it.each([false, true])(
        'keeps non-Vite hosts unchanged (response ok: %s)',
        async (ok) => {
            fetchMock.mockResolvedValue({ ok, headers: { get: () => null } });
            await initializeStandaloneDelivery();
            expect(connectViteClientContext).not.toHaveBeenCalled();
            expect(setClientRouteEnvironment).not.toHaveBeenCalled();
        }
    );

    it('reports a missing Vite connection as disconnected', async () => {
        fetchMock.mockResolvedValue({ ok: true, headers: { get: () => '/' } });
        jest.mocked(connectViteClientContext).mockResolvedValue(null);
        await initializeStandaloneDelivery();
        expect(setClientRuntimeState).toHaveBeenLastCalledWith({
            connectionStatus: 'disconnected'
        });
    });

    it('tolerates hosts that reject the metadata request', async () => {
        fetchMock.mockRejectedValue(new Error('Unavailable'));
        await expect(initializeStandaloneDelivery()).resolves.toBeUndefined();
        expect(setClientRuntimeState).not.toHaveBeenCalled();
    });

    it('reports a rejected Vite connection instead of waiting forever', async () => {
        fetchMock.mockResolvedValue({ ok: true, headers: { get: () => '/' } });
        jest.mocked(connectViteClientContext).mockRejectedValue(
            new Error('Offline')
        );
        await initializeStandaloneDelivery();
        expect(setClientRuntimeState).toHaveBeenLastCalledWith({
            connectionStatus: 'disconnected'
        });
    });
    it.each(['connected', 'error'] as const)(
        'uses backend-confirmed %s for a supplied standalone session',
        async (status) => {
            fetchMock.mockResolvedValue({
                ok: true,
                headers: { get: () => '/' }
            });
            jest.mocked(connectViteClientContext).mockResolvedValue({
                on: jest.fn(),
                send: jest.fn()
            });
            const session = {
                connect: jest.fn(async () => {}),
                getSnapshot: () => ({ sessionId: 'standalone', status }),
                subscribe: () => () => {},
                dispose: () => {}
            };
            await initializeStandaloneDelivery(session);
            expect(session.connect).toHaveBeenCalledTimes(1);
            expect(setClientRuntimeState).toHaveBeenLastCalledWith({
                connectionStatus:
                    status === 'connected' ? 'connected' : 'disconnected'
            });
        }
    );
});
