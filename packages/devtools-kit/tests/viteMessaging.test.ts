import {
    VITE_RPC_EVENT_KEY,
    clearViteClientContext,
    clearViteServerContext,
    connectViteClientContext,
    createRpcClient,
    createRpcServer,
    createViteClientChannel,
    createViteProxyChannel,
    createViteServerChannel,
    getViteClientContext,
    setViteClientContext,
    setViteServerContext,
    type ViteHotContextLike,
    type ViteMessageHandler,
    type ViteServerLike
} from '../src/index.js';

interface ServerFunctions {
    getRoot(payload: { id: string }): { id: string; name: string };
}

interface ClientFunctions {
    ping: () => string;
}

describe('vite messaging preset', () => {
    afterEach(() => {
        clearViteClientContext();
        clearViteServerContext();
    });

    it('completes an RPC round-trip through mock Vite websocket contexts', async () => {
        const { clientHot, server } = createMockViteBus();

        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                getRoot(payload) {
                    return { id: payload.id, name: 'App' };
                }
            },
            { channel: createViteServerChannel({ server }) }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                ping() {
                    return 'pong';
                }
            },
            { channel: createViteClientChannel({ hot: clientHot }) }
        );

        await expect(client.getRoot({ id: 'root:1' })).resolves.toEqual({
            id: 'root:1',
            name: 'App'
        });
    });

    it('uses only the React DevTools custom event namespace', () => {
        const { clientHot, emittedEvents, server } = createMockViteBus();
        const serverChannel = createViteServerChannel({ server });
        const clientChannel = createViteClientChannel({ hot: clientHot });
        const serverHandler = jest.fn();
        const clientHandler = jest.fn();

        serverChannel.on(serverHandler);
        clientChannel.on(clientHandler);
        clientHot.send('vite:beforeUpdate', { type: 'hmr' });
        server.ws?.send('vite:beforeUpdate', { type: 'hmr' });
        clientHot.send(VITE_RPC_EVENT_KEY, { type: 'client-to-server' });
        server.ws?.send(VITE_RPC_EVENT_KEY, { type: 'server-to-client' });

        expect(serverHandler).toHaveBeenCalledTimes(1);
        expect(serverHandler).toHaveBeenCalledWith({
            type: 'client-to-server'
        });
        expect(clientHandler).toHaveBeenCalledTimes(1);
        expect(clientHandler).toHaveBeenCalledWith({
            type: 'server-to-client'
        });
        expect(emittedEvents).toEqual([
            'vite:beforeUpdate',
            'vite:beforeUpdate',
            VITE_RPC_EVENT_KEY,
            VITE_RPC_EVENT_KEY
        ]);
    });

    it('prefers Vite hot over ws on the server when both are present', () => {
        const hot = createRecordingHotContext();
        const ws = createRecordingHotContext();
        const channel = createViteServerChannel({
            server: {
                hot,
                ws
            }
        });

        channel.post('hello');

        expect(hot.sent).toEqual([
            { event: VITE_RPC_EVENT_KEY, payload: 'hello' }
        ]);
        expect(ws.sent).toEqual([]);
    });

    it('resolves default vite preset channels from stored contexts', async () => {
        const { clientHot, server } = createMockViteBus();

        setViteClientContext(clientHot);
        setViteServerContext(server);
        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                getRoot(payload) {
                    return { id: payload.id, name: 'Stored App' };
                }
            },
            { preset: 'vite' }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                ping() {
                    return 'pong';
                }
            },
            { preset: 'vite' }
        );

        await expect(client.getRoot({ id: 'stored' })).resolves.toEqual({
            id: 'stored',
            name: 'Stored App'
        });
    });

    it('connects a vite-hot-client context and stores it by default', async () => {
        const hot = createRecordingHotContext();

        await expect(
            connectViteClientContext({
                base: '/app/',
                createHotContext: async (path, base) => {
                    expect(path).toBe('/react-devtools');
                    expect(base).toBe('/app/');
                    return hot;
                },
                path: '/react-devtools'
            })
        ).resolves.toBe(hot);
        expect(getViteClientContext()).toBe(hot);
    });

    it('removes registered listeners via off', () => {
        const { clientHot, server } = createMockViteBus();
        const serverHandler = jest.fn();
        const clientHandler = jest.fn();
        const serverChannel = createViteServerChannel({ server });
        const clientChannel = createViteClientChannel({ hot: clientHot });

        serverChannel.on(serverHandler);
        clientChannel.on(clientHandler);
        serverChannel.off?.(serverHandler);
        clientChannel.off?.(clientHandler);
        clientHot.send(VITE_RPC_EVENT_KEY, 'client');
        server.ws?.send(VITE_RPC_EVENT_KEY, 'server');

        expect(serverHandler).not.toHaveBeenCalled();
        expect(clientHandler).not.toHaveBeenCalled();
    });

    it('returns noop channels when Vite handles are missing', () => {
        const clientChannel = createViteClientChannel();
        const serverChannel = createViteServerChannel();
        const proxyChannel = createViteProxyChannel();

        expect(() => clientChannel.post('ignored')).not.toThrow();
        expect(() => clientChannel.on(jest.fn())).not.toThrow();
        expect(() => serverChannel.post('ignored')).not.toThrow();
        expect(() => serverChannel.on(jest.fn())).not.toThrow();
        expect(() => proxyChannel.post('ignored')).not.toThrow();
    });
});

interface RecordingHotContext extends ViteHotContextLike {
    emit(event: string, payload: unknown): void;
    sent: Array<{ event: string; payload: unknown }>;
}

function createRecordingHotContext(): RecordingHotContext {
    const listeners = new Map<string, Set<ViteMessageHandler>>();

    return {
        emit(event, payload) {
            for (const handler of listeners.get(event) ?? []) {
                handler(payload);
            }
        },
        off(event, handler) {
            listeners.get(event)?.delete(handler);
        },
        on(event, handler) {
            const eventListeners = listeners.get(event) ?? new Set();

            eventListeners.add(handler);
            listeners.set(event, eventListeners);
        },
        send(event, payload) {
            this.sent.push({ event, payload });
        },
        sent: []
    };
}

function createMockViteBus(): {
    clientHot: ViteHotContextLike;
    emittedEvents: string[];
    server: ViteServerLike;
} {
    const clientListeners = new Map<string, Set<ViteMessageHandler>>();
    const serverListeners = new Map<string, Set<ViteMessageHandler>>();
    const emittedEvents: string[] = [];
    const addListener = (
        listeners: Map<string, Set<ViteMessageHandler>>,
        event: string,
        handler: ViteMessageHandler
    ) => {
        const eventListeners = listeners.get(event) ?? new Set();

        eventListeners.add(handler);
        listeners.set(event, eventListeners);
    };
    const removeListener = (
        listeners: Map<string, Set<ViteMessageHandler>>,
        event: string,
        handler: ViteMessageHandler
    ) => {
        listeners.get(event)?.delete(handler);
    };
    const emit = (
        listeners: Map<string, Set<ViteMessageHandler>>,
        event: string,
        payload: unknown
    ) => {
        emittedEvents.push(event);

        for (const handler of listeners.get(event) ?? []) {
            handler(payload);
        }
    };

    return {
        clientHot: {
            off(event, handler) {
                removeListener(clientListeners, event, handler);
            },
            on(event, handler) {
                addListener(clientListeners, event, handler);
            },
            send(event, payload) {
                emit(serverListeners, event, payload);
            }
        },
        emittedEvents,
        server: {
            ws: {
                off(event, handler) {
                    removeListener(serverListeners, event, handler);
                },
                on(event, handler) {
                    addListener(serverListeners, event, handler);
                },
                send(event, payload) {
                    emit(clientListeners, event, payload);
                }
            }
        }
    };
}
