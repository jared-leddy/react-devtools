import {
    IFRAME_RPC_EVENT_KEY,
    createIframeClientChannel,
    createIframeProxyChannel,
    createIframeServerChannel,
    createRpcClient,
    createRpcServer,
    type WindowLike,
    type WindowMessageEvent,
    type WindowMessageListener
} from '../src/index.js';

interface ServerFunctions {
    inspectCollections: (payload: {
        ids: Set<string>;
        values: Map<string, number>;
    }) => {
        ids: Set<string>;
        values: Map<string, number>;
    };
}

interface ClientFunctions {
    ping: () => string;
}

describe('iframe messaging preset', () => {
    it('completes an RPC round-trip between parent and iframe windows', async () => {
        const { child, iframe, parent } = createIframeWindowPair();
        const serverChannel = createIframeServerChannel({
            allowedOrigin: child.origin,
            iframe,
            targetOrigin: child.origin,
            window: parent
        });
        const clientChannel = createIframeClientChannel({
            allowedOrigin: parent.origin,
            targetOrigin: parent.origin,
            window: child
        });

        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                inspectCollections(payload) {
                    return payload;
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
            { channel: clientChannel }
        );

        const result = await client.inspectCollections({
            ids: new Set(['root', 'child']),
            values: new Map([['count', 2]])
        });

        expect(result.ids).toBeInstanceOf(Set);
        expect(result.values).toBeInstanceOf(Map);
        expect(Array.from(result.ids)).toEqual(['root', 'child']);
        expect(result.values.get('count')).toBe(2);
    });

    it('ignores iframe messages from an unexpected origin', () => {
        const { child, iframe, parent } = createIframeWindowPair();
        const channel = createIframeServerChannel({
            allowedOrigin: child.origin,
            iframe,
            targetOrigin: child.origin,
            window: parent
        });
        const handler = jest.fn();

        channel.on(handler);
        parent.dispatchMessage({
            data: {
                data: 'spoofed',
                event: IFRAME_RPC_EVENT_KEY,
                kind: 'message'
            },
            origin: 'https://spoof.example',
            source: child
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it('buffers parent-to-iframe messages until the child signals ready', () => {
        const { child, iframe, parent } = createIframeWindowPair();
        const serverChannel = createIframeServerChannel({
            allowedOrigin: child.origin,
            iframe,
            targetOrigin: child.origin,
            window: parent
        });
        const clientMessages: unknown[] = [];

        serverChannel.on(jest.fn());
        serverChannel.post('queued-before-ready');
        expect(child.receivedMessages).toEqual([]);

        const clientChannel = createIframeClientChannel({
            allowedOrigin: parent.origin,
            targetOrigin: parent.origin,
            window: child
        });
        clientChannel.on((data) => clientMessages.push(data));

        expect(clientMessages).toEqual(['queued-before-ready']);
        expect(child.receivedMessages).toEqual([
            {
                data: 'queued-before-ready',
                event: IFRAME_RPC_EVENT_KEY,
                kind: 'message'
            }
        ]);
    });

    it('removes registered listeners via off', () => {
        const { child, iframe, parent } = createIframeWindowPair();
        const serverChannel = createIframeServerChannel({
            allowedOrigin: child.origin,
            iframe,
            targetOrigin: child.origin,
            window: parent
        });
        const serverHandler = jest.fn();
        const clientChannel = createIframeClientChannel({
            allowedOrigin: parent.origin,
            targetOrigin: parent.origin,
            window: child
        });
        const clientHandler = jest.fn();

        serverChannel.on(serverHandler);
        serverChannel.off?.(serverHandler);
        clientChannel.on(clientHandler);
        clientChannel.off?.(clientHandler);

        parent.postMessage(
            { data: 'server', event: IFRAME_RPC_EVENT_KEY, kind: 'message' },
            parent.origin
        );
        child.postMessage(
            { data: 'client', event: IFRAME_RPC_EVENT_KEY, kind: 'message' },
            child.origin
        );

        expect(serverHandler).not.toHaveBeenCalled();
        expect(clientHandler).not.toHaveBeenCalled();
    });

    it('returns noop channels when required browser handles are missing', () => {
        const missingWindowChannel = createIframeClientChannel();
        const missingIframeChannel = createIframeServerChannel({
            iframe: null,
            window: createMockWindow('https://parent.example')
        });
        const proxyChannel = createIframeProxyChannel();

        expect(() => missingWindowChannel.post('ignored')).not.toThrow();
        expect(() => missingWindowChannel.on(jest.fn())).not.toThrow();
        expect(() => missingIframeChannel.post('ignored')).not.toThrow();
        expect(() => missingIframeChannel.on(jest.fn())).not.toThrow();
        expect(() => proxyChannel.post('ignored')).not.toThrow();
    });
});

function createIframeWindowPair(): {
    child: MockWindow;
    iframe: { contentWindow: MockWindow };
    parent: MockWindow;
} {
    const parent = createMockWindow('https://parent.example');
    const child = createMockWindow('https://child.example');

    parent.postMessage = (data: unknown) => {
        parent.receivedMessages.push(data);
        parent.dispatchMessage({
            data,
            origin: child.origin,
            source: child
        });
    };
    child.parent = parent;
    child.postMessage = (data: unknown) => {
        child.receivedMessages.push(data);
        child.dispatchMessage({
            data,
            origin: parent.origin,
            source: parent
        });
    };

    return { child, iframe: { contentWindow: child }, parent };
}

interface MockWindow extends WindowLike {
    dispatchMessage(event: WindowMessageEvent): void;
    origin: string;
    receivedMessages: unknown[];
}

function createMockWindow(origin: string): MockWindow {
    const listeners = new Set<WindowMessageListener>();

    return {
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        dispatchMessage(event) {
            for (const listener of listeners) {
                listener(event);
            }
        },
        location: { origin },
        origin,
        postMessage(data) {
            this.receivedMessages.push(data);
        },
        receivedMessages: [],
        removeEventListener(_type, listener) {
            listeners.delete(listener);
        }
    };
}
