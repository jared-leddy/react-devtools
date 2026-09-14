type ChannelOptions = {
    deserialize?: (data: unknown) => unknown;
    off?: (listener: (data: unknown) => void) => void;
    on: (listener: (data: unknown) => void) => void;
    post: (data: unknown) => void | Promise<void>;
    serialize?: (data: unknown) => unknown;
};

type RpcMessage =
    | { args: unknown[]; id: number; method: string; type: 'call' }
    | { error?: unknown; id: number; result?: unknown; type: 'response' };

type RpcObject = Record<string, (...args: unknown[]) => unknown>;

let nextId = 0;

export function createBirpc<
    RemoteFunctions extends object,
    LocalFunctions extends object
>(functions: LocalFunctions, options: ChannelOptions): RemoteFunctions {
    const pending = new Map<
        number,
        {
            reject: (error: unknown) => void;
            resolve: (value: unknown) => void;
        }
    >();
    const localFunctions = functions as RpcObject;
    const serialize = options.serialize ?? ((data: unknown) => data);
    const deserialize = options.deserialize ?? ((data: unknown) => data);

    const listener = (rawMessage: unknown) => {
        const message = deserialize(rawMessage) as RpcMessage;

        if (message.type === 'response') {
            const request = pending.get(message.id);

            if (!request) {
                return;
            }

            pending.delete(message.id);

            if (message.error) {
                request.reject(message.error);
            } else {
                request.resolve(message.result);
            }

            return;
        }

        const fn = localFunctions[message.method];

        void Promise.resolve()
            .then(() => fn(...message.args))
            .then(
                (result) =>
                    options.post(
                        serialize({
                            id: message.id,
                            result,
                            type: 'response'
                        })
                    ),
                (error) =>
                    options.post(
                        serialize({
                            error,
                            id: message.id,
                            type: 'response'
                        })
                    )
            );
    };

    options.on(listener);

    const proxyTarget = {
        $close() {
            options.off?.(listener);
        }
    } as unknown as RemoteFunctions;

    return new Proxy(proxyTarget, {
        get(target, property) {
            if (property in target) {
                return target[property as keyof typeof target];
            }

            return (...args: unknown[]) => {
                const id = ++nextId;

                return new Promise((resolve, reject) => {
                    pending.set(id, { reject, resolve });
                    void options.post(
                        serialize({
                            args,
                            id,
                            method: String(property),
                            type: 'call'
                        })
                    );
                });
            };
        }
    }) as RemoteFunctions;
}

export function createBirpcGroup<
    RemoteFunctions extends object,
    LocalFunctions extends object
>(
    functions: LocalFunctions,
    channels: ChannelOptions[]
): {
    broadcast: RemoteFunctions;
    clients: RemoteFunctions[];
    functions: LocalFunctions;
    updateChannels: (
        callback?: (channels: ChannelOptions[]) => void
    ) => RemoteFunctions[];
} {
    const state = {
        channels: [...channels],
        clients: [] as RemoteFunctions[]
    };
    const createClients = () => {
        state.clients = state.channels.map((channel) =>
            createBirpc<RemoteFunctions, LocalFunctions>(functions, channel)
        );
    };

    createClients();

    return {
        get broadcast() {
            return new Proxy(
                {},
                {
                    get(_target, property) {
                        return (...args: unknown[]) =>
                            Promise.all(
                                state.clients.map((client) => {
                                    const fn = client[
                                        property as keyof RemoteFunctions
                                    ] as (...callArgs: unknown[]) => unknown;

                                    return fn(...args);
                                })
                            );
                    }
                }
            ) as RemoteFunctions;
        },
        get clients() {
            return state.clients;
        },
        functions,
        updateChannels(callback) {
            callback?.(state.channels);
            createClients();

            return state.clients;
        }
    };
}
