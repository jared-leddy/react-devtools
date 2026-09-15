import {
    createRpcClient,
    createRpcServer,
    type RpcChannel
} from '../src/index.js';

interface SerializationPayload {
    callback?: () => string;
    callbacks: unknown[];
    ids: Set<string>;
    maybeUndefined?: string;
    nested: {
        run?: () => void;
        values: Array<{ label: string; value?: number }>;
    };
    self?: SerializationPayload;
    title: string;
    values: Map<string, { count: number; missing?: undefined }>;
}

interface FunctionInspection {
    arrayCallbackType: string;
    hasTopLevelCallback: boolean;
    nestedKeys: string[];
}

interface ServerFunctions {
    echo: (payload: SerializationPayload) => SerializationPayload;
    inspectFunctions: (payload: SerializationPayload) => FunctionInspection;
}

interface ClientFunctions {
    describeClient: () => string;
}

interface SerializationClient {
    echo: (payload: SerializationPayload) => Promise<SerializationPayload>;
    inspectFunctions: (
        payload: SerializationPayload
    ) => Promise<FunctionInspection>;
}

describe('messaging RPC SuperJSON round-trip', () => {
    it('preserves Map, Set, undefined, nested values, and circular references', async () => {
        const client = createSerializationClient();
        const payload = createSerializationPayload();

        const result = await client.echo(payload);

        expect(result).not.toBe(payload);
        expect(result.title).toBe('serialization-smoke');
        expect(result.ids).toBeInstanceOf(Set);
        expect(Array.from(result.ids)).toEqual(['root', 'leaf']);
        expect(result.values).toBeInstanceOf(Map);
        expect(Array.from(result.values.entries())).toEqual([
            ['first', { count: 1, missing: undefined }],
            ['second', { count: 2 }]
        ]);
        expect('maybeUndefined' in result).toBe(true);
        expect(result.maybeUndefined).toBeUndefined();
        expect(result.nested.values).toEqual([
            { label: 'defined', value: 1 },
            { label: 'undefined', value: undefined }
        ]);
        expect(result.self).toBe(result);
    });

    it('documents that function payload values do not survive serialization', async () => {
        const client = createSerializationClient();
        const payload = createSerializationPayload();

        const serverView = await client.inspectFunctions(payload);
        const result = await client.echo(payload);

        expect(serverView).toEqual({
            arrayCallbackType: 'undefined',
            hasTopLevelCallback: false,
            nestedKeys: ['values']
        });
        expect('callback' in result).toBe(false);
        expect('run' in result.nested).toBe(false);
        expect(result.callbacks).toHaveLength(1);
        expect(result.callbacks[0]).toBeUndefined();
    });
});

function createSerializationClient(): SerializationClient {
    const [clientChannel, serverChannel] = createLinkedChannels();

    createRpcServer<ClientFunctions, ServerFunctions>(
        {
            echo(payload) {
                return payload;
            },
            inspectFunctions(payload) {
                return {
                    arrayCallbackType: typeof payload.callbacks[0],
                    hasTopLevelCallback: 'callback' in payload,
                    nestedKeys: Object.keys(payload.nested)
                };
            }
        },
        { channel: serverChannel }
    );

    return createRpcClient<ServerFunctions, ClientFunctions>(
        {
            describeClient() {
                return 'serialization-client';
            }
        },
        { channel: clientChannel }
    ) as SerializationClient;
}

function createSerializationPayload(): SerializationPayload {
    const payload: SerializationPayload = {
        callback: () => 'dropped',
        callbacks: [() => 'also dropped'],
        ids: new Set(['root', 'leaf']),
        maybeUndefined: undefined,
        nested: {
            run() {},
            values: [
                { label: 'defined', value: 1 },
                { label: 'undefined', value: undefined }
            ]
        },
        title: 'serialization-smoke',
        values: new Map([
            ['first', { count: 1, missing: undefined }],
            ['second', { count: 2 }]
        ])
    };

    payload.self = payload;

    return payload;
}

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
