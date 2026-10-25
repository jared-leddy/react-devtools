import {
    createDevToolsCoreClient,
    type CreateDevToolsCoreClientOptions
} from './rpc.js';
import { DEVTOOLS_PROTOCOL_VERSION } from './protocol.js';
import type {
    DevToolsCoreState,
    ComponentStateRequest,
    ComponentStateResponse,
    DevToolsSessionCapabilities,
    DevToolsSessionStateSnapshot,
    DevToolsSessionUpdate
} from './types.js';

export { DEVTOOLS_PROTOCOL_VERSION } from './protocol.js';

export interface DevToolsSessionSnapshot {
    status: 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error';
    sessionId: string;
    clientId?: string;
    serverId?: string;
    streamId?: string;
    revision?: number;
    capabilities?: DevToolsSessionCapabilities;
    state?: DevToolsCoreState;
    error?: string;
}

export interface DevToolsSession {
    getSnapshot(): DevToolsSessionSnapshot;
    subscribe(listener: () => void): () => void;
    connect(): Promise<void>;
    inspectComponent?(
        request: ComponentStateRequest
    ): Promise<ComponentStateResponse | undefined>;
    dispose(): void;
}

export function createDevToolsSession(
    options: CreateDevToolsCoreClientOptions & {
        clientId?: string;
        timeoutMs?: number;
        heartbeatMs?: number;
        reconnectMs?: number | false;
    } = {}
): DevToolsSession {
    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    )
        throw new Error('Session timeout must be a positive finite number');
    const sessionId = globalThis.crypto.randomUUID();
    const reconnectMs =
        options.reconnectMs ?? (options.preset === 'extension' ? 1000 : false);
    if (
        reconnectMs !== false &&
        (!Number.isFinite(reconnectMs) || reconnectMs <= 0)
    )
        throw new Error('Session reconnect delay must be positive');
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let clientClosed = false;
    const scheduleReconnect = () => {
        if (disposed || reconnectMs === false || reconnectTimer !== undefined)
            return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            void api.connect();
        }, reconnectMs);
    };
    const clientId = options.clientId ?? sessionId;
    if (
        options.heartbeatMs !== undefined &&
        (!Number.isFinite(options.heartbeatMs) || options.heartbeatMs <= 0)
    )
        throw new Error('Session heartbeat must be a positive finite number');
    let snapshot: DevToolsSessionSnapshot = {
        status: 'waiting',
        sessionId,
        clientId
    };
    const listeners = new Set<() => void>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let disposed = false;
    let connection: Promise<void> | undefined;
    let resynchronizing = false;
    let generation = 0;
    let pending: DevToolsSessionUpdate[] = [];
    let needsSnapshot = false;
    let heartbeat: ReturnType<typeof setTimeout> | undefined;
    const publish = (next: DevToolsSessionSnapshot) => {
        snapshot = { ...next, clientId };
        listeners.forEach((listener) => listener());
    };
    const bounded = async <T>(
        request: Promise<T>,
        timeout: number,
        operation = 'request'
    ): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                request,
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(
                        () =>
                            reject(
                                new Error(`DevTools ${operation} timed out`)
                            ),
                        timeout
                    );
                    timers.add(timer);
                })
            ]);
        } finally {
            clearTimeout(timer);
            if (timer) timers.delete(timer);
        }
    };
    const close = () => {
        clearTimeout(heartbeat);
        if (snapshot.streamId)
            void client
                .disconnectSession({ sessionId, streamId: snapshot.streamId })
                .catch(() => {});
        client.$close();
        clientClosed = true;
        timers.forEach(clearTimeout);
        timers.clear();
    };
    const fail = (error: unknown) => {
        if (!disposed) {
            generation += 1;
            close();
            connection = undefined;
            publish({
                sessionId,
                status: 'error',
                error:
                    error instanceof Error
                        ? error.message
                        : 'Backend rejected handshake'
            });
            scheduleReconnect();
        }
    };
    const disconnect = (closeClient = true) => {
        clearTimeout(heartbeat);
        generation += 1;
        pending = [];
        needsSnapshot = false;
        connection = undefined;
        if (closeClient) close();
        if (!disposed) publish({ sessionId, status: 'disconnected' });
        scheduleReconnect();
    };
    const accept = (update: DevToolsSessionUpdate) => {
        if (update.patch.transportStatus === 'disconnected') {
            disconnect(false);
            return;
        }
        const componentState = { ...snapshot.state!.componentState };
        update.invalidatedComponents.forEach((id) => {
            delete componentState[id];
        });
        const state = { ...snapshot.state!, ...update.patch, componentState };
        publish({
            ...snapshot,
            revision: update.revision,
            state,
            status:
                state.transportStatus === 'disconnected'
                    ? 'disconnected'
                    : 'connected'
        });
    };
    const drain = () => {
        if (disposed || snapshot.status !== 'connected') return;
        pending = pending.filter(
            (update) =>
                update.streamId === snapshot.streamId &&
                update.revision > snapshot.revision!
        );
        while (snapshot.status === 'connected') {
            const index = pending.findIndex(
                (update) => update.baseRevision === snapshot.revision
            );
            if (index < 0) break;
            accept(pending.splice(index, 1)[0]);
            pending = pending.filter(
                (update) => update.revision > snapshot.revision!
            );
        }
        if (pending.length || needsSnapshot) void resynchronize();
    };
    const resynchronize = async () => {
        if (resynchronizing || snapshot.status !== 'connected') return;
        resynchronizing = true;
        const expectedGeneration = generation;
        const streamId = snapshot.streamId!;
        const before = snapshot.revision!;
        try {
            const response = await bounded(
                client.getSessionSnapshot({ sessionId, streamId }),
                options.timeoutMs ?? 5000,
                'snapshot'
            );
            if (
                disposed ||
                generation !== expectedGeneration ||
                snapshot.status !== 'connected'
            )
                return;
            if (
                !validSnapshot(response) ||
                response.sessionId !== sessionId ||
                response.streamId !== streamId
            )
                throw new Error('Invalid resynchronization snapshot');
            if (response.revision > snapshot.revision!)
                if (response.state.transportStatus === 'disconnected')
                    disconnect(false);
                else
                    publish({
                        ...snapshot,
                        revision: response.revision,
                        state: response.state,
                        status:
                            response.state.transportStatus === 'connected'
                                ? 'connected'
                                : 'disconnected'
                    });
            pending = pending.filter(
                (update) =>
                    update.streamId === streamId &&
                    update.revision > snapshot.revision!
            );
            needsSnapshot = false;
            if (pending.length && snapshot.revision! <= before)
                throw new Error('Snapshot did not recover the revision gap');
        } catch (error) {
            if (generation === expectedGeneration) fail(error);
        } finally {
            resynchronizing = false;
            drain();
        }
    };
    const checkRevision = async () => {
        const expectedGeneration = generation;
        if (disposed || snapshot.status !== 'connected') return;
        const streamId = snapshot.streamId!;
        try {
            const response = await bounded(
                client.getSessionRevision({ sessionId, streamId }),
                options.timeoutMs ?? 5000,
                'revision check'
            );
            if (
                disposed ||
                expectedGeneration !== generation ||
                snapshot.status !== 'connected'
            )
                return;
            if (
                !response ||
                response.sessionId !== sessionId ||
                response.streamId !== streamId ||
                !Number.isSafeInteger(response.revision) ||
                response.revision < 0
            )
                throw new Error('Invalid session revision');
            if (response.revision > snapshot.revision!) {
                needsSnapshot = true;
                drain();
            }
        } catch (error) {
            if (expectedGeneration === generation) fail(error);
        } finally {
            if (
                !disposed &&
                snapshot.status === 'connected' &&
                expectedGeneration === generation
            )
                heartbeat = setTimeout(
                    checkRevision,
                    options.heartbeatMs ?? 1000
                );
        }
    };
    const makeClient = () =>
        createDevToolsCoreClient({
            ...options,
            options: {
                ...options.options,
                timeout: options.timeoutMs ?? 5000
            },
            onDisconnect() {
                disconnect();
                options.onDisconnect?.();
            },
            // Protocol-v1 callbacks remain available to direct RPC callers, not session state.
            onStateUpdated: (patch) => options.onStateUpdated?.(patch),
            onTransportStatus: (status) => options.onTransportStatus?.(status),
            onSessionUpdated(update) {
                if (
                    disposed ||
                    !validUpdate(update) ||
                    update.sessionId !== sessionId
                )
                    return;
                if (snapshot.streamId && update.streamId !== snapshot.streamId)
                    return;
                if (
                    snapshot.status !== 'connecting' &&
                    snapshot.status !== 'connected'
                )
                    return;
                if (pending.length === 64) {
                    pending.shift();
                    needsSnapshot = true;
                }
                pending.push(update);
                drain();
                options.onSessionUpdated?.(update);
            }
        });
    let client = makeClient();

    const api: DevToolsSession = {
        async inspectComponent(request) {
            if (
                disposed ||
                snapshot.status !== 'connected' ||
                !snapshot.capabilities?.componentState
            )
                throw new Error('Component inspection unavailable');
            const streamId = snapshot.streamId;
            const revision = snapshot.revision;
            const inspectionGeneration = generation;
            let result: ComponentStateResponse | undefined;
            try {
                result = await client.getComponentState(request);
            } catch (error) {
                if (
                    disposed ||
                    generation !== inspectionGeneration ||
                    snapshot.status !== 'connected' ||
                    snapshot.streamId !== streamId ||
                    snapshot.revision !== revision
                )
                    return undefined;
                throw error;
            }
            if (
                disposed ||
                generation !== inspectionGeneration ||
                snapshot.status !== 'connected' ||
                snapshot.streamId !== streamId ||
                snapshot.revision !== revision
            )
                return undefined;
            if (
                result &&
                (result.componentId !== request.componentId ||
                    result.rootId !== request.rootId)
            )
                throw new Error('Invalid component inspection response');
            return result;
        },
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
            clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
            if (snapshot.status === 'disconnected' && !clientClosed) close();
            if (clientClosed) {
                client = makeClient();
                clientClosed = false;
            }
            publish({ sessionId, status: 'connecting' });
            const expectedGeneration = generation;
            connection = (async () => {
                const deadline = Date.now() + (options.timeoutMs ?? 5000);
                try {
                    const request = async (): Promise<
                        Awaited<ReturnType<typeof client.handshake>>
                    > => {
                        try {
                            return await bounded(
                                client.handshake({
                                    clientId,
                                    sessionId,
                                    protocolVersion: DEVTOOLS_PROTOCOL_VERSION
                                }),
                                Math.min(
                                    600,
                                    Math.max(1, deadline - Date.now())
                                ),
                                'handshake'
                            );
                        } catch (error) {
                            if (
                                !disposed &&
                                error instanceof Error &&
                                /timeout|timed out/.test(error.message)
                            ) {
                                if (Date.now() < deadline) return request();
                                throw new Error('DevTools handshake timed out');
                            }
                            throw error;
                        }
                    };
                    const response = await request();
                    if (disposed) return;
                    if (generation !== expectedGeneration)
                        throw new Error(
                            'Transport disconnected during handshake'
                        );
                    if (
                        !validSnapshot(response) ||
                        response.sessionId !== sessionId ||
                        response.protocolVersion !==
                            DEVTOOLS_PROTOCOL_VERSION ||
                        !response.serverId ||
                        !response.capabilities ||
                        response.state.transportStatus !== 'connected' ||
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
                    )
                        throw new Error(
                            'Invalid DevTools handshake or protocol mismatch'
                        );
                    publish({
                        sessionId,
                        serverId: response.serverId,
                        streamId: response.streamId,
                        revision: response.revision,
                        status: 'connected',
                        state: response.state,
                        capabilities: response.capabilities
                    });
                    drain();
                    if (snapshot.status === 'connected')
                        heartbeat = setTimeout(
                            checkRevision,
                            options.heartbeatMs ?? 1000
                        );
                } catch (error) {
                    if (generation === expectedGeneration) fail(error);
                }
            })();
            return connection;
        },
        dispose() {
            if (disposed) return;
            clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
            close();
            disposed = true;
            generation += 1;
            pending = [];
            publish({ sessionId, status: 'disconnected' });
            listeners.clear();
        }
    };
    return api;
}

function validSnapshot(value: DevToolsSessionStateSnapshot): boolean {
    return (
        !!value &&
        typeof value.streamId === 'string' &&
        value.streamId.length > 0 &&
        Number.isSafeInteger(value.revision) &&
        value.revision >= 0 &&
        !!value.state &&
        Array.isArray(value.state.renderers) &&
        Array.isArray(value.state.roots) &&
        ['connected', 'connecting', 'disconnected'].includes(
            value.state.transportStatus
        )
    );
}

function validUpdate(value: DevToolsSessionUpdate): boolean {
    return (
        !!value &&
        typeof value.streamId === 'string' &&
        Number.isSafeInteger(value.baseRevision) &&
        value.baseRevision >= 0 &&
        Number.isSafeInteger(value.revision) &&
        value.revision > value.baseRevision &&
        !!value.patch &&
        typeof value.patch === 'object' &&
        !Array.isArray(value.patch) &&
        Array.isArray(value.invalidatedComponents) &&
        value.invalidatedComponents.every((id) => typeof id === 'string')
    );
}
