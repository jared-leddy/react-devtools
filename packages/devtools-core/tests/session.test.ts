import {
    createDevToolsSession,
    createDevToolsCoreStateStore,
    createDevToolsCoreServer,
    createDevToolsCoreServerFunctions,
    type RpcChannel
} from '../src/index.js';
import { DEVTOOLS_PROTOCOL_VERSION } from '../src/session.js';
import { createRpcServer } from '@devtools/kit';
import { createDevToolsSessionRelay } from '../src/sessionRelay.js';

function channels(): [RpcChannel, RpcChannel, Set<(data: unknown) => void>] {
    const left = new Set<(data: unknown) => void>();
    const right = new Set<(data: unknown) => void>();
    return [
        {
            on: (fn) => {
                left.add(fn);
            },
            off: (fn) => {
                left.delete(fn);
            },
            post: (data) => {
                right.forEach((fn) => fn(data));
            }
        },
        {
            on: (fn) => {
                right.add(fn);
            },
            off: (fn) => {
                right.delete(fn);
            },
            post: (data) => {
                left.forEach((fn) => fn(data));
            }
        },
        left
    ];
}

describe('backend-confirmed sessions', () => {
    it('uses distinct session identities when clients reuse the same display alias', async () => {
        const [channel, backend] = channels();
        const store = createDevToolsCoreStateStore();
        const server = createDevToolsCoreServer({ channel: backend, store });
        const first = createDevToolsSession({
            channel,
            clientId: 'same-alias'
        });
        const second = createDevToolsSession({
            channel,
            clientId: 'same-alias'
        });
        try {
            expect(first.getSnapshot().sessionId).not.toBe(
                second.getSnapshot().sessionId
            );
            await first.connect();
            await second.connect();
            first.dispose();
            store.setRoots([{ id: 'still-active' }]);
            await new Promise((resolve) => setTimeout(resolve, 25));
            expect(second.getSnapshot()).toMatchObject({
                status: 'connected',
                state: { roots: [{ id: 'still-active' }] }
            });
        } finally {
            first.dispose();
            second.dispose();
            server.dispose();
        }
    });
    it.each([0, -1, Infinity, NaN])(
        'rejects invalid timeout %s before allocating a transport',
        (timeoutMs) => {
            expect(() => createDevToolsSession({ timeoutMs })).toThrow(
                'positive finite'
            );
        }
    );
    it('disposes an in-flight handshake and settles without late connected state', async () => {
        const [client, , listeners] = channels();
        const session = createDevToolsSession({ channel: client });
        const connecting = session.connect();
        session.dispose();
        await connecting;
        expect(session.getSnapshot().status).toBe('disconnected');
        expect(listeners.size).toBe(0);
    });
    it('invalidates an in-flight handshake on transport disconnect', async () => {
        const [client, backend] = channels();
        let disconnect: (() => void) | undefined;
        const server = createDevToolsCoreServer({ channel: backend });
        const onDisconnect = jest.fn();
        const session = createDevToolsSession({
            channel: {
                ...client,
                subscribeDisconnect(listener) {
                    disconnect = listener;
                    return () => {
                        disconnect = undefined;
                    };
                }
            },
            onDisconnect
        });
        const connecting = session.connect();
        disconnect?.();
        await connecting;
        expect(session.getSnapshot().status).toBe('error');
        expect(onDisconnect).toHaveBeenCalledTimes(1);
        session.dispose();
        server.dispose();
    });
    it('relays a borrowed host session without claiming unsupported inspector operations or owning the host', async () => {
        const [hostClient, hostBackend] = channels();
        const store = createDevToolsCoreStateStore();
        const backend = createDevToolsCoreServer({
            channel: hostBackend,
            store
        });
        const host = createDevToolsSession({
            channel: hostClient,
            clientId: 'host'
        });
        const [frameClient, frameBackend] = channels();
        const relay = createDevToolsSessionRelay(host, frameBackend);
        const frame = createDevToolsSession({
            channel: frameClient,
            clientId: 'frame'
        });
        await frame.connect();
        expect(frame.getSnapshot()).toMatchObject({
            status: 'connected',
            capabilities: { components: true }
        });
        store.setRoots([{ id: 'host-root' }]);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(frame.getSnapshot().state?.roots[0].id).toBe('host-root');
        relay.dispose();
        expect(host.getSnapshot().status).toBe('connected');
        frame.dispose();
        host.dispose();
        backend.dispose();
    });
    it('delivers the initial snapshot, capabilities and live updates through one idempotent connection', async () => {
        const [client, backend, listeners] = channels();
        const store = createDevToolsCoreStateStore();
        store.setRoots([{ id: 'actual-root' }]);
        const server = createDevToolsCoreServer({ channel: backend, store });
        const session = createDevToolsSession({
            channel: client,
            clientId: 'panel'
        });
        const listener = jest.fn();
        const off = session.subscribe(listener);
        expect(session.getSnapshot().status).toBe('waiting');
        const connecting = session.connect();
        expect(session.connect()).toBe(connecting);
        await connecting;
        expect(session.getSnapshot()).toMatchObject({
            status: 'connected',
            sessionId: expect.any(String),
            capabilities: { edit: false, stores: false },
            state: { roots: [{ id: 'actual-root' }] }
        });
        store.setRoots([{ id: 'updated-root' }]);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(session.getSnapshot().state?.roots[0].id).toBe('updated-root');
        off();
        const calls = listener.mock.calls.length;
        session.dispose();
        session.dispose();
        await session.connect();
        session.subscribe(listener)();
        expect(listener).toHaveBeenCalledTimes(calls);
        expect(listeners.size).toBe(0);
        expect(session.getSnapshot().status).toBe('disconnected');
        server.dispose();
    });

    it.each(['mismatch', 'rejection', 'missing-capability'])(
        'never connects on %s',
        async (mode) => {
            const [client, backend] = channels();
            const functions = createDevToolsCoreServerFunctions(
                createDevToolsCoreStateStore()
            );
            createRpcServer(
                {
                    ...functions,
                    handshake: (request: { clientId: string }) => {
                        if (mode === 'rejection')
                            throw new Error('Backend rejected');
                        const response = functions.handshake({
                            clientId: request.clientId
                        });
                        return {
                            ...response,
                            protocolVersion:
                                mode === 'mismatch'
                                    ? DEVTOOLS_PROTOCOL_VERSION + 1
                                    : DEVTOOLS_PROTOCOL_VERSION,
                            capabilities:
                                mode === 'missing-capability'
                                    ? undefined
                                    : response.capabilities
                        };
                    }
                },
                { channel: backend }
            );
            const session = createDevToolsSession({ channel: client });
            await session.connect();
            expect(session.getSnapshot()).toMatchObject({ status: 'error' });
            expect(session.getSnapshot().state).toBeUndefined();
            session.dispose();
        }
    );

    it('times out an absent backend and ignores responses after disposal', async () => {
        const [client, , listeners] = channels();
        const session = createDevToolsSession({
            channel: client,
            timeoutMs: 5
        });
        await session.connect();
        expect(session.getSnapshot()).toMatchObject({
            status: 'error',
            error: 'DevTools handshake timed out'
        });
        expect(listeners.size).toBe(0);
        session.dispose();
    });

    it('rejects unsupported protocol requests before marking the store connected', () => {
        const store = createDevToolsCoreStateStore();
        expect(() =>
            createDevToolsCoreServerFunctions(store).handshake({
                clientId: 'bad',
                protocolVersion: 99
            })
        ).toThrow('Unsupported');
        expect(store.getState().transportStatus).not.toBe('connected');
    });
});
