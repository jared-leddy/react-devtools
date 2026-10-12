import {
    createDevToolsCoreClient,
    type CreateDevToolsCoreClientOptions
} from './rpc.js';
import type {
    DevToolsCoreState,
    DevToolsSessionCapabilities
} from './types.js';

export const DEVTOOLS_PROTOCOL_VERSION = 1;

export interface DevToolsSessionSnapshot {
    status: 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
    sessionId: string;
    serverId?: string;
    capabilities?: DevToolsSessionCapabilities;
    state?: DevToolsCoreState;
    error?: string;
}

export interface DevToolsSession {
    getSnapshot(): DevToolsSessionSnapshot;
    subscribe(listener: () => void): () => void;
    connect(): Promise<void>;
    dispose(): void;
}

export function createDevToolsSession(
    options: CreateDevToolsCoreClientOptions & {
        clientId?: string;
        timeoutMs?: number;
    } = {}
): DevToolsSession {
    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    )
        throw new Error('Session timeout must be a positive finite number');
    const sessionId = options.clientId ?? globalThis.crypto.randomUUID();
    let snapshot: DevToolsSessionSnapshot = { status: 'waiting', sessionId };
    const listeners = new Set<() => void>();
    let disposed = false;
    let connection: Promise<void> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let transportGeneration = 0;
    const publish = (next: DevToolsSessionSnapshot) => {
        snapshot = next;
        listeners.forEach((listener) => listener());
    };
    const client = createDevToolsCoreClient({
        ...options,
        options: {
            ...options.options,
            timeout: Math.min(600, options.timeoutMs ?? 5000)
        },
        onDisconnect() {
            transportGeneration += 1;
            if (!disposed) publish({ sessionId, status: 'disconnected' });
            options.onDisconnect?.();
        },
        onStateUpdated(patch) {
            if (
                !disposed &&
                snapshot.status === 'connected' &&
                snapshot.state
            ) {
                publish({
                    ...snapshot,
                    state: { ...snapshot.state, ...patch }
                });
            }
            options.onStateUpdated?.(patch);
        },
        onTransportStatus(status) {
            if (!disposed && status !== 'connected') {
                transportGeneration += 1;
                publish({ sessionId, status: 'disconnected' });
            }
            options.onTransportStatus?.(status);
        }
    });

    return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
            if (disposed) return () => {};
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        connect() {
            if (disposed) return Promise.resolve();
            if (connection) return connection;
            publish({ sessionId, status: 'connecting' });
            const generation = transportGeneration;
            connection = (async () => {
                const deadline = Date.now() + (options.timeoutMs ?? 5000);
                try {
                    const requestHandshake = async (): Promise<
                        Awaited<ReturnType<typeof client.handshake>>
                    > => {
                        try {
                            return await Promise.race([
                                client.handshake({
                                    clientId: sessionId,
                                    protocolVersion: DEVTOOLS_PROTOCOL_VERSION
                                }),
                                new Promise<never>((_resolve, reject) => {
                                    timer = setTimeout(
                                        () =>
                                            reject(
                                                new Error(
                                                    'DevTools handshake timed out'
                                                )
                                            ),
                                        Math.min(
                                            600,
                                            Math.max(1, deadline - Date.now())
                                        )
                                    );
                                })
                            ]);
                        } catch (error) {
                            clearTimeout(timer);
                            if (
                                !disposed &&
                                error instanceof Error &&
                                /timeout|timed out/.test(error.message)
                            ) {
                                if (Date.now() < deadline)
                                    return requestHandshake();
                                throw new Error('DevTools handshake timed out');
                            }
                            throw error;
                        }
                    };
                    const response = await requestHandshake();
                    if (disposed) return;
                    if (generation !== transportGeneration)
                        throw new Error(
                            'Transport disconnected during handshake'
                        );
                    if (
                        response.protocolVersion !==
                            DEVTOOLS_PROTOCOL_VERSION ||
                        !response.serverId ||
                        !response.state ||
                        !response.capabilities ||
                        !Array.isArray(response.state.renderers) ||
                        !Array.isArray(response.state.roots) ||
                        !(
                            [
                                'roots',
                                'components',
                                'componentState',
                                'highlight',
                                'inspect',
                                'edit',
                                'stores'
                            ] as const
                        ).every(
                            (key) =>
                                typeof response.capabilities[key] === 'boolean'
                        )
                    ) {
                        throw new Error(
                            'Invalid DevTools handshake or protocol mismatch'
                        );
                    }
                    publish({
                        sessionId,
                        serverId: response.serverId,
                        status: 'connected',
                        state: response.state,
                        capabilities: response.capabilities
                    });
                } catch (error) {
                    if (!disposed)
                        publish({
                            sessionId,
                            status: 'error',
                            error:
                                error instanceof Error
                                    ? error.message
                                    : 'Backend rejected handshake'
                        });
                    client.$close();
                } finally {
                    clearTimeout(timer);
                }
            })();
            return connection;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            clearTimeout(timer);
            client.$close();
            publish({ sessionId, status: 'disconnected' });
            listeners.clear();
        }
    };
}
