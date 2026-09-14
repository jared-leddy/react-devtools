import {
    BROADCAST_CHANNEL_RPC_EVENT_KEY,
    createBroadcastChannelClientChannel,
    createBroadcastChannelProxyChannel,
    createBroadcastChannelServerChannel,
    createRpcClient,
    createRpcServer,
    getBroadcastChannelRpcChannel,
    type BroadcastChannelLike,
    type BroadcastChannelMessageHandler
} from '../src/index.js';

interface ServerFunctions {
    getComponent(payload: { id: string }): { id: string; name: string };
}

interface ClientFunctions {
    ping: () => string;
}

describe('broadcast-channel messaging preset', () => {
    it('completes an RPC round-trip between same-origin contexts', async () => {
        const BroadcastChannel = createMockBroadcastChannelConstructor();
        const serverChannel = createBroadcastChannelServerChannel({
            BroadcastChannel,
            senderId: 'server',
            sessionId: 'session-a'
        });
        const clientChannel = createBroadcastChannelClientChannel({
            BroadcastChannel,
            senderId: 'client',
            sessionId: 'session-a'
        });

        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                getComponent(payload) {
                    return { id: payload.id, name: 'Counter' };
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

        await expect(
            client.getComponent({ id: 'component:1' })
        ).resolves.toEqual({
            id: 'component:1',
            name: 'Counter'
        });
    });

    it('isolates independently named sessions on the same channel name', () => {
        const BroadcastChannel = createMockBroadcastChannelConstructor();
        const sessionA = createBroadcastChannelClientChannel({
            BroadcastChannel,
            senderId: 'a-client',
            sessionId: 'a'
        });
        const sessionB = createBroadcastChannelServerChannel({
            BroadcastChannel,
            senderId: 'b-server',
            sessionId: 'b'
        });
        const aHandler = jest.fn();
        const bHandler = jest.fn();

        sessionA.on(aHandler);
        sessionB.on(bHandler);
        sessionA.post('from-a');
        sessionB.post('from-b');

        expect(aHandler).not.toHaveBeenCalled();
        expect(bHandler).not.toHaveBeenCalled();
    });

    it('isolates independently named BroadcastChannel names', () => {
        const BroadcastChannel = createMockBroadcastChannelConstructor();
        const first = createBroadcastChannelClientChannel({
            BroadcastChannel,
            channelName: 'first',
            senderId: 'first-client'
        });
        const second = createBroadcastChannelServerChannel({
            BroadcastChannel,
            channelName: 'second',
            senderId: 'second-server'
        });
        const handler = jest.fn();

        second.on(handler);
        first.post('miss');

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores self-sent and foreign event messages', () => {
        const BroadcastChannel = createMockBroadcastChannelConstructor();
        const channel = createBroadcastChannelClientChannel({
            BroadcastChannel,
            senderId: 'client',
            sessionId: 'session-a'
        });
        const handler = jest.fn();

        channel.on(handler);
        channel.post('self');
        getMockBroadcastChannel(BroadcastChannel, 0).dispatchMessage({
            event: BROADCAST_CHANNEL_RPC_EVENT_KEY,
            senderId: 'server',
            sessionId: 'session-a'
        });
        getMockBroadcastChannel(BroadcastChannel, 0).dispatchMessage({
            data: 'foreign event',
            event: 'vite:beforeUpdate',
            senderId: 'server',
            sessionId: 'session-a'
        });

        expect(handler).not.toHaveBeenCalled();
    });

    it('removes registered listeners via off', () => {
        const BroadcastChannel = createMockBroadcastChannelConstructor();
        const client = createBroadcastChannelClientChannel({
            BroadcastChannel,
            senderId: 'client'
        });
        const server = createBroadcastChannelServerChannel({
            BroadcastChannel,
            senderId: 'server'
        });
        const handler = jest.fn();

        client.on(handler);
        client.off?.(handler);
        client.off?.(handler);
        server.post('ignored');

        expect(handler).not.toHaveBeenCalled();
    });

    it('supports onmessage-only BroadcastChannel implementations', () => {
        const BroadcastChannel = createOnMessageBroadcastChannelConstructor();
        const client = createBroadcastChannelClientChannel({
            BroadcastChannel,
            senderId: 'client'
        });
        const server = createBroadcastChannelServerChannel({
            BroadcastChannel,
            senderId: 'server'
        });
        const handler = jest.fn();

        client.on(handler);
        server.post('delivered');
        client.off?.(handler);
        server.post('ignored');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('delivered');
    });

    it('resolves default broadcast-channel preset channels without a global constructor', () => {
        const originalBroadcastChannel = globalThis.BroadcastChannel;

        try {
            Object.defineProperty(globalThis, 'BroadcastChannel', {
                configurable: true,
                value: undefined
            });

            expect(() =>
                getBroadcastChannelRpcChannel('client').post('ignored')
            ).not.toThrow();
            expect(() =>
                getBroadcastChannelRpcChannel('server').post('ignored')
            ).not.toThrow();
            expect(() =>
                createBroadcastChannelProxyChannel().post('ignored')
            ).not.toThrow();
        } finally {
            Object.defineProperty(globalThis, 'BroadcastChannel', {
                configurable: true,
                value: originalBroadcastChannel
            });
        }
    });
});

interface MockBroadcastChannel extends BroadcastChannelLike {
    dispatchMessage(payload: unknown): void;
    readonly name: string;
}

type MockBroadcastChannelConstructor = {
    channels: MockBroadcastChannel[];
    new (name: string): MockBroadcastChannel;
};

function createMockBroadcastChannelConstructor(): MockBroadcastChannelConstructor {
    const channelsByName = new Map<string, MockBroadcastChannel[]>();

    class MockBroadcastChannelImplementation implements MockBroadcastChannel {
        readonly name: string;
        readonly listeners = new Set<BroadcastChannelMessageHandler>();
        onmessage: BroadcastChannelMessageHandler | null = null;

        constructor(name: string) {
            this.name = name;
            const channels = channelsByName.get(name) ?? [];

            channels.push(this);
            channelsByName.set(name, channels);
            MockBroadcastChannelImplementation.channels.push(this);
        }

        addEventListener(
            _type: 'message',
            handler: BroadcastChannelMessageHandler
        ) {
            this.listeners.add(handler);
        }

        dispatchMessage(payload: unknown) {
            const event = { data: payload };

            for (const listener of this.listeners) {
                listener(event);
            }

            this.onmessage?.(event);
        }

        postMessage(data: unknown) {
            for (const channel of channelsByName.get(this.name) ?? []) {
                channel.dispatchMessage(data);
            }
        }

        removeEventListener(
            _type: 'message',
            handler: BroadcastChannelMessageHandler
        ) {
            this.listeners.delete(handler);
        }

        static channels: MockBroadcastChannel[] = [];
    }

    return MockBroadcastChannelImplementation;
}

function createOnMessageBroadcastChannelConstructor(): MockBroadcastChannelConstructor {
    const Base = createMockBroadcastChannelConstructor();

    class OnMessageBroadcastChannel extends Base {
        addEventListener = undefined;
        removeEventListener = undefined;
    }

    return OnMessageBroadcastChannel;
}

function getMockBroadcastChannel(
    BroadcastChannel: MockBroadcastChannelConstructor,
    index: number
): MockBroadcastChannel {
    return BroadcastChannel.channels[index];
}
