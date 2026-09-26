import {
    EXTENSION_RPC_EVENT_KEY,
    EXTENSION_RPC_MESSAGE_SOURCE,
    createExtensionClientChannel,
    createExtensionProxyChannel,
    createExtensionServerChannel,
    isExtensionRpcEnvelope,
    type ChromeLike,
    type ExtensionDisconnectHandler,
    type ExtensionMessageHandler,
    type ExtensionPortLike,
    type ExtensionWindowLike,
    type ExtensionWindowMessageEvent,
    type ExtensionWindowMessageListener
} from '../src/bridgeContract';

describe('extension bridge contract', () => {
    it('validates page-to-content bridge envelopes before delivery', () => {
        const extensionWindow = createMockWindow();
        const channel = createExtensionServerChannel({
            window: extensionWindow
        });
        const handler = jest.fn();

        channel.on(handler);
        extensionWindow.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: { rendererId: 1 },
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });
        extensionWindow.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: 'wrong direction',
                source: EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY
            }
        });
        extensionWindow.dispatchMessage({
            data: {
                event: 'vite:beforeUpdate',
                payload: 'hmr',
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });
        extensionWindow.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ rendererId: 1 });
        expect(
            isExtensionRpcEnvelope(
                {
                    event: EXTENSION_RPC_EVENT_KEY,
                    payload: 'ok',
                    source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
                },
                EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            )
        ).toBe(true);
        expect(
            isExtensionRpcEnvelope(
                {
                    event: EXTENSION_RPC_EVENT_KEY,
                    source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
                },
                EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            )
        ).toBe(false);
    });

    it('relays content-script messages between page window and background port', () => {
        const runtime = createMockExtensionRuntime();
        const extensionWindow = createMockWindow();

        createExtensionProxyChannel({
            chrome: createMockChrome(runtime),
            window: extensionWindow
        });

        const port = runtime.getPort('content-script');
        port?.emitMessage({ from: 'background' });

        expect(extensionWindow.postedMessages).toEqual([
            {
                payload: {
                    event: EXTENSION_RPC_EVENT_KEY,
                    payload: { from: 'background' },
                    source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
                },
                targetOrigin: '*'
            }
        ]);

        extensionWindow.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: { from: 'page' },
                source: EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY
            }
        });
        extensionWindow.dispatchMessage({
            data: {
                event: EXTENSION_RPC_EVENT_KEY,
                payload: { ignored: true },
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            }
        });

        expect(port?.sentMessages).toEqual([{ from: 'page' }]);
    });

    it('connects the DevTools panel to the inspected tab background port', () => {
        const runtime = createMockExtensionRuntime();
        const channel = createExtensionClientChannel({
            chrome: createMockChrome(runtime, 101)
        });
        const handler = jest.fn();

        channel.on(handler);
        channel.post({ request: 'inspect-root' });
        runtime.getPort('101')?.emitMessage({ response: 'root-ready' });

        expect(runtime.connectCalls).toEqual(['101']);
        expect(runtime.getPort('101')?.sentMessages).toEqual([
            { request: 'inspect-root' }
        ]);
        expect(handler).toHaveBeenCalledWith({ response: 'root-ready' });
    });

    it('queues panel messages across tab reload disconnects and reconnects', () => {
        const runtime = createMockExtensionRuntime();
        const reconnectTimers: Array<() => void> = [];
        const channel = createExtensionClientChannel({
            chrome: createMockChrome(runtime, 202),
            setTimeout(handler) {
                reconnectTimers.push(handler);
                return reconnectTimers.length;
            }
        });
        const handler = jest.fn();

        channel.on(handler);
        runtime.getPort('202')?.disconnect();
        channel.post({ request: 'after-reload' });
        runtime.getPort('202')?.emitMessage({ ignored: 'old-port' });

        expect(handler).not.toHaveBeenCalled();
        expect(runtime.connectCalls).toEqual(['202']);

        reconnectTimers[0]?.();
        runtime.getPort('202')?.emitMessage({ response: 'reconnected' });

        expect(runtime.connectCalls).toEqual(['202', '202']);
        expect(runtime.getPort('202')?.sentMessages).toContainEqual({
            request: 'after-reload'
        });
        expect(handler).toHaveBeenCalledWith({ response: 'reconnected' });
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

interface MockExtensionWindow extends ExtensionWindowLike {
    dispatchMessage(event: ExtensionWindowMessageEvent): void;
    postedMessages: Array<{
        payload: unknown;
        targetOrigin: string;
    }>;
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
                const port = createMockExtensionPort(name);
                const ports = portsByName.get(name) ?? [];

                connectCalls.push(name);
                ports.push(port);
                portsByName.set(name, ports);

                return port;
            }
        }
    };
}

function createMockExtensionPort(name: string): MockExtensionPort {
    const messageHandlers = new Set<ExtensionMessageHandler>();
    const disconnectHandlers = new Set<ExtensionDisconnectHandler>();
    let connected = true;

    return {
        disconnect() {
            if (!connected) {
                return;
            }

            connected = false;
            for (const handler of disconnectHandlers) {
                handler();
            }
        },
        emitMessage(payload) {
            for (const handler of messageHandlers) {
                handler(payload);
            }
        },
        name,
        onDisconnect: {
            addListener(handler) {
                disconnectHandlers.add(handler);
            },
            removeListener(handler) {
                disconnectHandlers.delete(handler);
            }
        },
        onMessage: {
            addListener(handler) {
                messageHandlers.add(handler);
            },
            removeListener(handler) {
                messageHandlers.delete(handler);
            }
        },
        postMessage(payload) {
            if (!connected) {
                throw new Error('Port is disconnected.');
            }

            this.sentMessages.push(payload);
        },
        sentMessages: []
    };
}

function createMockWindow(): MockExtensionWindow {
    const listeners = new Set<ExtensionWindowMessageListener>();
    const postedMessages: MockExtensionWindow['postedMessages'] = [];

    return {
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        dispatchMessage(event) {
            for (const listener of listeners) {
                listener(event);
            }
        },
        postMessage(payload, targetOrigin) {
            postedMessages.push({ payload, targetOrigin });
        },
        postedMessages,
        removeEventListener(_type, listener) {
            listeners.delete(listener);
        }
    };
}
