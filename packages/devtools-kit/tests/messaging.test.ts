import {
    createRpcClient,
    createRpcProxy,
    createRpcServer,
    rpcSerializer,
    type Presets,
    type RpcChannel,
    type RpcHost
} from '../src/index.js';

interface ServerFunctions {
    fail: () => Promise<void>;
    getCollections: () => {
        ids: Set<string>;
        values: Map<string, number>;
    };
}

interface ClientFunctions {
    describeClient: () => string;
}

describe('messaging RPC core', () => {
    it('round-trips Map and Set payloads through a mock channel', async () => {
        const [clientChannel, serverChannel] = createLinkedChannels();
        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                async fail() {
                    throw new Error('boom');
                },
                getCollections() {
                    return {
                        ids: new Set(['a', 'b']),
                        values: new Map([
                            ['one', 1],
                            ['two', 2]
                        ])
                    };
                }
            },
            { channel: serverChannel }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                describeClient() {
                    return 'test-client';
                }
            },
            { channel: clientChannel }
        );

        const result = await client.getCollections();

        expect(result.ids).toBeInstanceOf(Set);
        expect(result.values).toBeInstanceOf(Map);
        expect(Array.from(result.ids)).toEqual(['a', 'b']);
        expect(Array.from(result.values.entries())).toEqual([
            ['one', 1],
            ['two', 2]
        ]);
    });

    it('propagates server errors to the caller', async () => {
        const [clientChannel, serverChannel] = createLinkedChannels();
        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                async fail() {
                    throw new TypeError('server exploded');
                },
                getCollections() {
                    return { ids: new Set(), values: new Map() };
                }
            },
            { channel: serverChannel }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                describeClient() {
                    return 'test-client';
                }
            },
            { channel: clientChannel }
        );

        await expect(client.fail()).rejects.toMatchObject({
            message: 'server exploded',
            name: 'TypeError'
        });
    });

    it('resolves preset channels through a provided factory for client, server, and proxy hosts', async () => {
        const [clientChannel, serverChannel] = createLinkedChannels();
        const [proxyChannel] = createLinkedChannels();
        const calls: Array<{ host: RpcHost; preset: Presets }> = [];
        const getChannel = (preset: Presets, host: RpcHost): RpcChannel => {
            calls.push({ host, preset });

            if (host === 'client') {
                return clientChannel;
            }

            if (host === 'server') {
                return serverChannel;
            }

            return proxyChannel;
        };

        createRpcServer<ClientFunctions, ServerFunctions>(
            {
                async fail() {},
                getCollections() {
                    return { ids: new Set(), values: new Map() };
                }
            },
            { getChannel, preset: 'iframe' }
        );
        const client = createRpcClient<ServerFunctions, ClientFunctions>(
            {
                describeClient() {
                    return 'test-client';
                }
            },
            { getChannel, preset: 'iframe' }
        );
        createRpcProxy<ServerFunctions, ClientFunctions>({
            getChannel,
            preset: 'extension'
        });

        await expect(client.getCollections()).resolves.toMatchObject({
            ids: expect.any(Set),
            values: expect.any(Map)
        });
        expect(calls).toEqual([
            { host: 'server', preset: 'iframe' },
            { host: 'client', preset: 'iframe' },
            { host: 'proxy', preset: 'extension' }
        ]);
    });

    it('throws when no channel is available for an unresolved preset', () => {
        expect(() =>
            createRpcClient<ServerFunctions, ClientFunctions>(
                {
                    describeClient() {
                        return 'test-client';
                    }
                },
                { preset: 'broadcast-channel' }
            )
        ).toThrow('RPC preset "broadcast-channel" is not available');
    });

    it('throws when neither a channel nor preset is provided', () => {
        expect(() =>
            createRpcServer<ClientFunctions, ServerFunctions>({
                async fail() {},
                getCollections() {
                    return { ids: new Set(), values: new Map() };
                }
            })
        ).toThrow('RPC channel is required');
    });

    it('exposes a SuperJSON serializer that preserves collection instances', () => {
        const payload = {
            ids: new Set(['x']),
            values: new Map([['answer', 42]])
        };
        const serialized = rpcSerializer.serialize(payload);
        const deserialized =
            rpcSerializer.deserialize<typeof payload>(serialized);

        expect(deserialized.ids).toBeInstanceOf(Set);
        expect(deserialized.values).toBeInstanceOf(Map);
        expect(deserialized.ids.has('x')).toBe(true);
        expect(deserialized.values.get('answer')).toBe(42);
    });
});

function createLinkedChannels(): [RpcChannel, RpcChannel] {
    const leftListeners = new Set<(data: unknown) => void>();
    const rightListeners = new Set<(data: unknown) => void>();

    return [
        {
            off(listener) {
                leftListeners.delete(listener);
            },
            on(listener) {
                leftListeners.add(listener);
            },
            post(data) {
                for (const listener of rightListeners) {
                    listener(data);
                }
            }
        },
        {
            off(listener) {
                rightListeners.delete(listener);
            },
            on(listener) {
                rightListeners.add(listener);
            },
            post(data) {
                for (const listener of leftListeners) {
                    listener(data);
                }
            }
        }
    ];
}
