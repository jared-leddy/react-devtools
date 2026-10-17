import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createDevToolsCoreServer } from '../packages/devtools-core/dist/rpc.js';
import {
    createDevToolsCoreStateStore,
    createDevToolsSession
} from '../packages/devtools-core/dist/browser.js';

async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert(Date.now() < deadline, 'Compiled session did not settle');
        await delay(5);
    }
}

function wire() {
    const client = new Set(),
        server = new Set();
    const traffic = [];
    let heldUpdate, heldSnapshot, snapshotId;
    let dropUpdate = false,
        holdSnapshot = false;
    const deliver = (handlers, frame) =>
        Promise.resolve().then(() =>
            handlers.forEach((handler) => handler(structuredClone(frame)))
        );
    const clientChannel = {
        on: (handler) => client.add(handler),
        off: (handler) => client.delete(handler),
        post(frame) {
            traffic.push(frame.json?.m);
            if (frame.json?.m === 'getSessionSnapshot')
                snapshotId = frame.json.i;
            return deliver(server, frame);
        }
    };
    const serverChannel = {
        on: (handler) => server.add(handler),
        off: (handler) => server.delete(handler),
        post(frame) {
            if (dropUpdate && frame.json?.m === 'notifySessionUpdated') {
                dropUpdate = false;
                heldUpdate = structuredClone(frame);
                return;
            }
            if (
                holdSnapshot &&
                frame.json?.t === 's' &&
                frame.json.i === snapshotId
            ) {
                heldSnapshot = structuredClone(frame);
                return;
            }
            return deliver(client, frame);
        }
    };
    return {
        clientChannel,
        serverChannel,
        traffic,
        client,
        server,
        dropNext() {
            dropUpdate = true;
        },
        holdSnapshot() {
            holdSnapshot = true;
        },
        hasHeldUpdate: () => !!heldUpdate,
        hasHeldSnapshot: () => !!heldSnapshot,
        releaseUpdate: () => deliver(client, heldUpdate),
        releaseSnapshot: () => {
            holdSnapshot = false;
            return deliver(client, heldSnapshot);
        }
    };
}

test('real Birpc/SuperJSON recovers a dropped final update and disposes its producer', async () => {
    const transport = wire();
    const store = createDevToolsCoreStateStore();
    store.setRoots([{ id: 'before' }]);
    const server = createDevToolsCoreServer({
        store,
        channel: transport.serverChannel,
        options: { timeout: 600 }
    });
    const session = createDevToolsSession({
        channel: transport.clientChannel,
        heartbeatMs: 25
    });
    try {
        await session.connect();
        assert.equal(session.getSnapshot().status, 'connected');
        transport.dropNext();
        store.setRoots([{ id: 'after' }]);
        await until(
            () => session.getSnapshot().state?.roots[0]?.id === 'after'
        );
        assert(transport.hasHeldUpdate());
        assert(transport.traffic.includes('getSessionSnapshot'));
        session.dispose();
        await delay(5);
        store.setRoots([{ id: 'paused' }]);
        await delay(25);
        assert.equal(transport.client.size, 0);
    } finally {
        session.dispose();
        server.dispose();
    }
    assert.equal(transport.server.size, 0);
});

test('real delayed snapshot frames cannot overwrite newer accepted updates', async () => {
    const transport = wire();
    const store = createDevToolsCoreStateStore();
    store.setRoots([{ id: 'initial' }]);
    const server = createDevToolsCoreServer({
        store,
        channel: transport.serverChannel,
        options: { timeout: 600 }
    });
    const session = createDevToolsSession({
        channel: transport.clientChannel,
        heartbeatMs: 25
    });
    try {
        await session.connect();
        transport.dropNext();
        transport.holdSnapshot();
        store.setRoots([{ id: 'snapshot' }]);
        await until(transport.hasHeldSnapshot);
        store.setRoots([{ id: 'newest' }]);
        await delay(25);
        await transport.releaseUpdate();
        await until(
            () => session.getSnapshot().state?.roots[0]?.id === 'newest'
        );
        const revision = session.getSnapshot().revision;
        await transport.releaseSnapshot();
        await delay(5);
        assert.equal(session.getSnapshot().state.roots[0].id, 'newest');
        assert.equal(session.getSnapshot().revision, revision);
    } finally {
        session.dispose();
        server.dispose();
    }
});
