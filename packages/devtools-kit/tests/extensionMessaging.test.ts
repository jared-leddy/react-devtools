import {
    EXTENSION_RPC_EVENT_KEY,
    EXTENSION_RPC_MESSAGE_SOURCE,
    clearExtensionClientContext,
    clearExtensionProxyContext,
    clearExtensionServerContext,
    createExtensionClientChannel,
    createExtensionPortChannel,
    createExtensionProxyChannel,
    createExtensionServerChannel,
    getExtensionRpcChannel,
    createRpcClient,
    createRpcServer,
    getExtensionClientContext,
    getExtensionProxyContext,
    getExtensionServerContext,
    setExtensionServerContext,
    type ChromeLike,
    type ExtensionDisconnectHandler,
    type ExtensionMessageHandler,
    type ExtensionPortLike,
    type ExtensionWindowLike,
    type ExtensionWindowMessageEvent,
    type ExtensionWindowMessageListener
} from '../src/index.js';

interface ServerFunctions {
    inspect(payload: { id: string }): { id: string; label: string };
}

interface ClientFunctions {
    ping: () => string;
}

describe('extension messaging preset', () => {
    afterEach(() => {
        clearExtensionClientContext();
        clearExtensionProxyContext();
        clearExtensionServerContext();
        jest.useRealTimers();
    });

    it('completes an RPC round-trip between panel client and page server through the proxy', async () => {
        const runtime = createMockExtensionRuntime();
        const window = createMockWindow();
        const chrome = createMockChrome(runtime, 42);
        const serverChannel = createExtensionServerChannel({ window });

        createExtensionProxyChannel({ chrome, window });
        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                inspect(payload) {
                    return { id: payload.id, label: 'Button' };
                }
            },
            { channel: serverChannel }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                ping() {
                    return 'pong';
                }
            },
            { channel: createExtensionClientChannel({ chrome }) }
        );

        await expect(client.inspect({ id: 'component:1' })).resolves.toEqual({
            id: 'component:1',
            label: 'Button'
        });
        expect(getExtensionClientContext()?.name).toBe('42');
        expect(getExtensionProxyContext()?.name).toBe('content-script');
        expect(getExtensionServerContext()).toBe(window);
    });

    it('ignores window messages outside the extension RPC namespace', () => {
        const window = createMockWindow();
        const channel = createExtensionServerChannel({ window });
        const handler = jest.fn();

        channel.on(handler);
        window.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: 'wrong direction',
                source: EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY
            }
        });
        window.dispatchMessage({
            data: {
                event: 'vite:beforeUpdate',
                payload: 'hmr',
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it('removes registered server listeners via off', () => {
        const window = createMockWindow();
        const channel = createExtensionServerChannel({ window });
        const handler = jest.fn();

        channel.on(handler);
        channel.off?.(handler);
        window.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: 'ignored',
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it('handles port disconnects gracefully and reconnects', () => {
        jest.useFakeTimers();

        const runtime = createMockExtensionRuntime();
        const chrome = createMockChrome(runtime, 7);
        const reconnectTimers: Array<() => void> = [];
        const channel = createExtensionClientChannel({
            chrome,
            setTimeout(handler) {
                reconnectTimers.push(handler);
                return 1;
            }
        });
        const handler = jest.fn();

        channel.on(handler);
        const firstPort = runtime.getPort('7');

        firstPort?.disconnect();
        expect(() => channel.post('queued')).not.toThrow();
        firstPort?.emitMessage('ignored-while-disconnected');
        expect(runtime.connectCalls).toEqual(['7']);
        expect(handler).not.toHaveBeenCalled();

        reconnectTimers[0]?.();
        expect(runtime.connectCalls).toEqual(['7', '7']);
        runtime.getPort('7')?.emitMessage('after-reconnect');

        expect(handler).toHaveBeenCalledWith('after-reconnect');
        expect(runtime.getPort('7')?.sentMessages).toContain('queued');
    });

    it('supports disabled reconnect and missing runtime ports', () => {
        const runtime = createRuntimeWithoutPorts();
        const channel = createExtensionClientChannel({
            chrome: { runtime: runtime.runtime },
            reconnectDelayMs: false
        });
        const handler = jest.fn();

        channel.on(handler);
        channel.off?.(handler);
        channel.off?.(handler);
        channel.post('queued-without-port');

        expect(runtime.connectCalls).toEqual(['devtools-panel']);
        expect(getExtensionClientContext()).toBe(null);
    });

    it('cleans up proxy listeners on disconnect and tolerates closed ports', () => {
        const runtime = createMockExtensionRuntime();
        const window = createMockWindow();
        const chrome = createMockChrome(runtime);

        createExtensionProxyChannel({ chrome, window });
        const port = runtime.getPort('content-script');

        port?.disconnect();
        expect(() =>
            window.dispatchMessage({
                data: {
                    event: EXTENSION_RPC_EVENT_KEY,
                    payload: 'ignored',
                    source: EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY
                }
            })
        ).not.toThrow();
        expect(port?.sentMessages).toEqual([]);
    });

    it('returns noop proxy channel when the runtime cannot create a port', () => {
        const runtime = createRuntimeWithoutPorts();
        const window = createMockWindow();
        const channel = createExtensionProxyChannel({
            chrome: { runtime: runtime.runtime },
            window
        });

        expect(() => channel.post('ignored')).not.toThrow();
        expect(() => channel.on(jest.fn())).not.toThrow();
    });

    it('creates direct port channels with off support', () => {
        const port = createMockExtensionPort('direct', jest.fn());
        const channel = createExtensionPortChannel(port);
        const handler = jest.fn();

        channel.on(handler);
        port.emitMessage('delivered');
        channel.off?.(handler);
        channel.off?.(handler);
        port.emitMessage('ignored');
        channel.post('posted');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('delivered');
        expect(port.sentMessages).toEqual(['posted']);
    });

    it('resolves default extension channels for proxy and client hosts', () => {
        expect(() =>
            getExtensionRpcChannel('proxy').post('ignored')
        ).not.toThrow();
        expect(() =>
            getExtensionRpcChannel('client').post('ignored')
        ).not.toThrow();
    });

    it('uses a stored server window when default extension preset resolves the server channel', async () => {
        const runtime = createMockExtensionRuntime();
        const window = createMockWindow();
        const chrome = createMockChrome(runtime);

        setExtensionServerContext(window);
        createExtensionProxyChannel({ chrome, window });
        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                inspect(payload) {
                    return { id: payload.id, label: 'Stored Server' };
                }
            },
            { preset: 'extension' }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                ping() {
                    return 'pong';
                }
            },
            { channel: createExtensionClientChannel({ chrome }) }
        );

        await expect(client.inspect({ id: 'stored' })).resolves.toEqual({
            id: 'stored',
            label: 'Stored Server'
        });
    });

    it('returns noop channels when extension handles are missing', () => {
        const clientChannel = createExtensionClientChannel({ chrome: null });
        const serverChannel = createExtensionServerChannel({ window: null });
        const proxyChannel = createExtensionProxyChannel({
            chrome: null,
            window: null
        });
        const portChannel = createExtensionPortChannel(null);

        expect(() => clientChannel.post('ignored')).not.toThrow();
        expect(() => clientChannel.on(jest.fn())).not.toThrow();
        expect(() => serverChannel.post('ignored')).not.toThrow();
        expect(() => serverChannel.on(jest.fn())).not.toThrow();
        expect(() => proxyChannel.post('ignored')).not.toThrow();
        expect(() => proxyChannel.on(jest.fn())).not.toThrow();
        expect(() => portChannel.post('ignored')).not.toThrow();
        expect(() => portChannel.on(jest.fn())).not.toThrow();
    });
});

interface MockExtensionRuntime {
    connectCalls: string[];
    getPort(name: string): MockExtensionPort | undefined;
    runtime: ChromeLike['runtime'];
}

interface MockExtensionPort extends ExtensionPortLike {
    disconnect(): void;
    emitMessage(payload: unknown): void;
    sentMessages: unknown[];
}

function createMockChrome(
    runtime: MockExtensionRuntime,
    tabId?: number
): ChromeLike {
    return {
        devtools: {
            inspectedWindow: { tabId }
        },
        runtime: runtime.runtime
    };
}

function createMockExtensionRuntime(): MockExtensionRuntime {
    const portsByName = new Map<string, MockExtensionPort[]>();
    const connectCalls: string[] = [];

    return {
        connectCalls,
        getPort(name) {
            return portsByName.get(name)?.at(-1);
        },
        runtime: {
            connect(options) {
                const name = options?.name ?? '';
                const port = createMockExtensionPort(name, (payload) => {
                    const targets =
                        name === 'content-script'
                            ? Array.from(portsByName)
                                  .filter(([portName]) => portName !== name)
                                  .flatMap(([, ports]) => ports)
                            : (portsByName.get('content-script') ?? []);

                    for (const target of targets) {
                        target.emitMessage(payload);
                    }
                });
                const ports = portsByName.get(name) ?? [];

                connectCalls.push(name);
                ports.push(port);
                portsByName.set(name, ports);

                return port;
            }
        }
    };
}

function createRuntimeWithoutPorts(): MockExtensionRuntime {
    const connectCalls: string[] = [];

    return {
        connectCalls,
        getPort() {
            return undefined;
        },
        runtime: {
            connect(options) {
                connectCalls.push(options?.name ?? '');
                return null as unknown as ExtensionPortLike;
            }
        }
    };
}

function createMockExtensionPort(
    name: string,
    relay: (payload: unknown) => void
): MockExtensionPort {
    const messageListeners = new Set<ExtensionMessageHandler>();
    const disconnectListeners = new Set<ExtensionDisconnectHandler>();
    let isDisconnected = false;

    return {
        disconnect() {
            if (isDisconnected) {
                return;
            }

            isDisconnected = true;

            for (const listener of disconnectListeners) {
                listener();
            }
        },
        emitMessage(payload) {
            if (isDisconnected) {
                return;
            }

            for (const listener of messageListeners) {
                listener(payload);
            }
        },
        name,
        onDisconnect: {
            addListener(handler) {
                disconnectListeners.add(handler);
            },
            removeListener(handler) {
                disconnectListeners.delete(handler);
            }
        },
        onMessage: {
            addListener(handler) {
                messageListeners.add(handler);
            },
            removeListener(handler) {
                messageListeners.delete(handler);
            }
        },
        postMessage(payload) {
            if (isDisconnected) {
                throw new Error('Port is disconnected');
            }

            this.sentMessages.push(payload);
            relay(payload);
        },
        sentMessages: []
    };
}

interface MockWindow extends ExtensionWindowLike {
    dispatchMessage(event: ExtensionWindowMessageEvent): void;
}

function createMockWindow(): MockWindow {
    const listeners = new Set<ExtensionWindowMessageListener>();

    return {
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        dispatchMessage(event) {
            for (const listener of listeners) {
                listener(event);
            }
        },
        postMessage(payload) {
            this.dispatchMessage({ data: payload });
        },
        removeEventListener(_type, listener) {
            listeners.delete(listener);
        }
    };
}
