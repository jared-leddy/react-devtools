import { createRpcServer } from '@devtools/kit';
import {
    createDevToolsCoreServerFunctions,
    createDevToolsCoreStateStore,
    createDevToolsSession,
    type DevToolsCoreClientFunctions,
    type DevToolsCoreHandshakeResponse,
    type DevToolsSessionStateSnapshot,
    type DevToolsSessionUpdate,
    type RpcChannel
} from '../src/index.js';

const cleanup: Array<() => void> = [];
afterEach(() => {
    cleanup.splice(0).forEach((dispose) => dispose());
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function harness(
    options: {
        handshake?: Promise<DevToolsCoreHandshakeResponse>;
        snapshot?: Promise<DevToolsSessionStateSnapshot>;
        heartbeatMs?: number;
        timeoutMs?: number;
    } = {}
) {
    const a = new Set<(data: unknown) => void>(),
        b = new Set<(data: unknown) => void>();
    const channel = (own: typeof a, remote: typeof b): RpcChannel => ({
        on: (fn) => {
            own.add(fn);
        },
        off: (fn) => {
            own.delete(fn);
        },
        post: (data) => {
            remote.forEach((fn) => fn(data));
        }
    });
    const store = createDevToolsCoreStateStore();
    store.setRoots([{ id: 'initial' }]);
    const base = createDevToolsCoreServerFunctions(store);
    const initial = {
        ...base.handshake({ clientId: 'panel' }),
        protocolVersion: 2
    };
    let latest: DevToolsSessionStateSnapshot = initial;
    let disconnected: (() => void) | undefined;
    const functions = {
        ...base,
        handshake: jest.fn(() => options.handshake ?? initial),
        getSessionSnapshot: jest.fn(() => options.snapshot ?? latest),
        getSessionRevision: jest.fn(() => ({
            sessionId: latest.sessionId,
            streamId: latest.streamId,
            revision: latest.revision
        }))
    };
    const server = createRpcServer<
        DevToolsCoreClientFunctions,
        typeof functions
    >(functions, { channel: channel(b, a) });
    const session = createDevToolsSession({
        clientId: 'panel',
        heartbeatMs: options.heartbeatMs,
        timeoutMs: options.timeoutMs ?? 100,
        channel: {
            ...channel(a, b),
            subscribeDisconnect(listener) {
                disconnected = listener;
                return () => {
                    disconnected = undefined;
                };
            }
        }
    });
    initial.sessionId = session.getSnapshot().sessionId;
    cleanup.push(() => {
        session.dispose();
        server.dispose();
    });
    return {
        initial,
        session,
        functions,
        server,
        disconnect: () => disconnected?.(),
        latest: (revision: number, id: string) => {
            latest = {
                ...initial,
                revision,
                state: { ...initial.state, roots: [{ id }] }
            };
            return latest;
        },
        send: (
            baseRevision: number,
            revision: number,
            id: string,
            override: Partial<DevToolsSessionUpdate> = {}
        ) =>
            server.broadcast.notifySessionUpdated({
                sessionId: initial.sessionId,
                streamId: initial.streamId,
                baseRevision,
                revision,
                patch: { roots: [{ id }] },
                invalidatedComponents: [],
                ...override
            })
    };
}

describe('ordered session reconciliation', () => {
    it('does not reconnect from buffered messages after an identified disconnect', async () => {
        const gate = deferred<DevToolsCoreHandshakeResponse>();
        const h = harness({ handshake: gate.promise });
        const connecting = h.session.connect();
        await h.send(0, 1, 'closed', {
            patch: { transportStatus: 'disconnected' }
        });
        await h.send(1, 2, 'must-not-reconnect', {
            patch: { transportStatus: 'connected' }
        });
        gate.resolve(h.initial);
        await connecting;
        expect(h.session.getSnapshot()).toMatchObject({
            status: 'disconnected',
            revision: 1
        });
    });
    it('reflects a disconnected backend discovered by heartbeat resynchronization', async () => {
        const h = harness({ heartbeatMs: 10 });
        await h.session.connect();
        h.latest(1, 'backend-closed').state.transportStatus = 'disconnected';
        await new Promise((resolve) => setTimeout(resolve, 35));
        expect(h.session.getSnapshot().status).toBe('disconnected');
    });
    it('buffers updates arriving before the initial snapshot and never publishes an older final state', async () => {
        const gate = deferred<DevToolsCoreHandshakeResponse>();
        const h = harness({ handshake: gate.promise });
        const connecting = h.session.connect();
        await h.send(0, 1, 'newer');
        await h.send(1, 2, 'newest');
        gate.resolve(h.initial);
        await connecting;
        expect(h.session.getSnapshot()).toMatchObject({
            revision: 2,
            state: { roots: [{ id: 'newest' }] }
        });
        expect(h.functions.getSessionSnapshot).not.toHaveBeenCalled();
    });
    it('rejects duplicate, older, foreign-stream and foreign-session updates', async () => {
        const h = harness();
        await h.session.connect();
        await h.send(0, 1, 'valid');
        const snapshot = h.session.getSnapshot();
        await h.send(0, 1, 'duplicate');
        await h.send(1, 2, 'foreign', { streamId: 'old-navigation' });
        await h.send(1, 2, 'foreign', { sessionId: 'old-panel' });
        await h.server.broadcast.notifyStateUpdated({
            roots: [{ id: 'unrevisioned' }]
        });
        await h.server.broadcast.setTransportStatus('disconnected');
        expect(h.session.getSnapshot()).toBe(snapshot);
        expect(h.functions.getSessionSnapshot).not.toHaveBeenCalled();
    });
    it('resynchronizes a gap and ignores a subsequently arriving old notification', async () => {
        const h = harness();
        await h.session.connect();
        h.latest(3, 'recovered');
        await h.send(2, 3, 'recovered');
        await settle();
        expect(h.functions.getSessionSnapshot).toHaveBeenCalledTimes(1);
        expect(h.session.getSnapshot().revision).toBe(3);
        await h.send(0, 1, 'late');
        expect(h.session.getSnapshot().state?.roots[0].id).toBe('recovered');
    });
    it('never overwrites newer live updates with a delayed resynchronization snapshot', async () => {
        const gate = deferred<DevToolsSessionStateSnapshot>();
        const h = harness({ snapshot: gate.promise });
        await h.session.connect();
        await h.send(1, 2, 'second');
        await h.send(0, 1, 'first');
        await h.send(2, 3, 'third');
        gate.resolve(h.latest(2, 'old-snapshot'));
        await settle();
        expect(h.session.getSnapshot()).toMatchObject({
            status: 'connected',
            revision: 3,
            state: { roots: [{ id: 'third' }] }
        });
        expect(h.functions.getSessionSnapshot).toHaveBeenCalledTimes(1);
    });
    it('resynchronizes overlapping batches rather than merging against the wrong baseline', async () => {
        const h = harness();
        await h.session.connect();
        await h.send(0, 1, 'first');
        h.latest(3, 'latest-snapshot');
        await h.send(0, 3, 'overlapping');
        await settle();
        expect(h.session.getSnapshot().state?.roots[0].id).toBe(
            'latest-snapshot'
        );
    });
    it('recovers a dropped final notification using revision-only heartbeats', async () => {
        const h = harness({ heartbeatMs: 10 });
        await h.session.connect();
        h.latest(1, 'last-notification-was-lost');
        await new Promise((resolve) => setTimeout(resolve, 35));
        expect(h.functions.getSessionRevision).toHaveBeenCalled();
        expect(h.functions.getSessionSnapshot).toHaveBeenCalledTimes(1);
        expect(h.session.getSnapshot().state?.roots[0].id).toBe(
            'last-notification-was-lost'
        );
    });
    it('bounds the pre-handshake queue and recovers an overflow from a fresh snapshot', async () => {
        const gate = deferred<DevToolsCoreHandshakeResponse>();
        const h = harness({ handshake: gate.promise });
        const connecting = h.session.connect();
        for (let revision = 1; revision <= 70; revision++)
            await h.send(revision - 1, revision, String(revision));
        h.latest(70, 'latest');
        gate.resolve(h.initial);
        await connecting;
        await settle();
        expect(h.session.getSnapshot().revision).toBe(70);
        expect(h.session.getSnapshot().state?.roots[0].id).toBe('latest');
    });
    it('invalidates cached values without shipping every component value', async () => {
        const h = harness();
        h.initial.state.componentState = {
            component: {
                componentId: 'component',
                rootId: 'initial',
                sections: []
            }
        };
        await h.session.connect();
        await h.send(0, 1, 'first', { invalidatedComponents: ['component'] });
        expect(h.session.getSnapshot().state?.componentState).toEqual({});
    });
    it.each(['dispose', 'disconnect'] as const)(
        'ignores late resync replies after %s',
        async (action) => {
            const gate = deferred<DevToolsSessionStateSnapshot>();
            const h = harness({ snapshot: gate.promise });
            await h.session.connect();
            await h.send(1, 2, 'gap');
            if (action === 'dispose') h.session.dispose();
            else h.disconnect();
            gate.resolve(h.latest(2, 'late'));
            await settle();
            expect(h.session.getSnapshot().status).toBe('disconnected');
            expect(h.session.getSnapshot().state).toBeUndefined();
        }
    );
    it.each([
        'foreign-stream',
        'foreign-session',
        'negative-revision',
        'non-progressing'
    ] as const)('fails closed on %s resync', async (mode) => {
        const gate = deferred<DevToolsSessionStateSnapshot>();
        const h = harness({ snapshot: gate.promise });
        await h.session.connect();
        await h.send(1, 2, 'gap');
        gate.resolve({
            ...h.latest(mode === 'non-progressing' ? 0 : 2, 'invalid'),
            ...(mode === 'foreign-stream'
                ? { streamId: 'other' }
                : mode === 'foreign-session'
                  ? { sessionId: 'other' }
                  : mode === 'negative-revision'
                    ? { revision: -1 }
                    : {})
        });
        await settle();
        expect(h.session.getSnapshot().status).toBe('error');
        expect(h.session.getSnapshot().state?.roots[0].id).toBe('initial');
    });
    it('times out a stuck resynchronization without reporting a healthy connection', async () => {
        const h = harness({ snapshot: new Promise(() => {}), timeoutMs: 15 });
        await h.session.connect();
        await h.send(1, 2, 'gap');
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(h.session.getSnapshot()).toMatchObject({
            status: 'error',
            error: expect.stringContaining('timed out')
        });
    });
    it('ignores malformed notifications and accepts an identified backend disconnect', async () => {
        const h = harness();
        await h.session.connect();
        const initial = h.session.getSnapshot();
        for (const override of [
            { baseRevision: -1 },
            { revision: NaN },
            { patch: [] },
            { invalidatedComponents: [1] }
        ])
            await h.send(
                0,
                1,
                'bad',
                override as Partial<DevToolsSessionUpdate>
            );
        expect(h.session.getSnapshot()).toBe(initial);
        await h.send(0, 1, 'disconnected', {
            patch: { transportStatus: 'disconnected' }
        });
        expect(h.session.getSnapshot().status).toBe('disconnected');
        await h.send(1, 2, 'must-not-reconnect');
        expect(h.session.getSnapshot().status).toBe('disconnected');
    });
    it.each([0, -1, Infinity, NaN])(
        'rejects invalid heartbeat interval %s',
        (heartbeatMs) => {
            expect(() => createDevToolsSession({ heartbeatMs })).toThrow(
                'positive finite'
            );
        }
    );
});
