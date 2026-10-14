import {
    createDevToolsCoreStateStore,
    createInitialDevToolsCoreState,
    createDevToolsUpdatePublisher
} from '../src/index.js';

describe('revisioned update producer', () => {
    it('does not deliver a captured batch to a recipient revoked during publication', () => {
        const store = createDevToolsCoreStateStore();
        let second: ReturnType<
            ReturnType<typeof createDevToolsUpdatePublisher>['connect']
        >;
        const publish = jest.fn((update) => {
            if (update.sessionId === 'first') producer.disconnect(second);
        });
        const producer = createDevToolsUpdatePublisher({ store, publish });
        producer.connect('first');
        second = producer.connect('second');
        store.setRoots([{ id: 'root' }]);
        producer.flush();
        expect(publish).toHaveBeenCalledTimes(1);
        producer.dispose();
    });
    it('stamps all recipients atomically when delivery causes another store mutation', () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest.fn((update) => {
            if (update.sessionId === 'first' && update.revision === 1)
                store.setRenderers([{ id: 2 }]);
        });
        const producer = createDevToolsUpdatePublisher({ store, publish });
        producer.connect('first');
        producer.connect('second');
        store.setRoots([{ id: 'root' }]);
        producer.flush();
        expect(publish.mock.calls.map(([update]) => update.revision)).toEqual([
            1, 1
        ]);
        producer.flush();
        expect(publish.mock.calls.slice(2).map(([update]) => update)).toEqual([
            expect.objectContaining({
                sessionId: 'first',
                baseRevision: 1,
                revision: 2
            }),
            expect.objectContaining({
                sessionId: 'second',
                baseRevision: 1,
                revision: 2
            })
        ]);
        producer.dispose();
    });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it.each([-1, Infinity, NaN])(
        'rejects invalid batching delay %s',
        (delayMs) => {
            expect(() =>
                createDevToolsUpdatePublisher({
                    store: createDevToolsCoreStateStore(),
                    publish: jest.fn(),
                    delayMs
                })
            ).toThrow('non-negative');
        }
    );
    it('coalesces fields and invalidates changed values without copying them', () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest.fn();
        const active = jest.fn();
        const producer = createDevToolsUpdatePublisher({
            store,
            publish,
            onActiveChange: active
        });
        store.setRoots([{ id: 'before' }]);
        producer.flush();
        expect(publish).not.toHaveBeenCalled();
        const initial = producer.connect('panel');
        expect(initial.revision).toBe(0);
        store.setRoots([{ id: 'latest' }]);
        store.setRenderers([{ id: 1 }]);
        store.setComponentState({
            componentId: 'component',
            rootId: 'latest',
            sections: [
                {
                    name: 'props',
                    fields: [{ name: 'callback', value: () => {} }]
                }
            ]
        });
        jest.advanceTimersByTime(16);
        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish).toHaveBeenCalledWith({
            sessionId: 'panel',
            streamId: initial.streamId,
            baseRevision: 0,
            revision: 3,
            patch: { roots: [{ id: 'latest' }], renderers: [{ id: 1 }] },
            invalidatedComponents: ['component']
        });
        store.update({ componentState: {} });
        producer.flush();
        expect(publish.mock.calls[1][0].invalidatedComponents).toEqual([
            'component'
        ]);
        expect(active).toHaveBeenCalledWith(true);
        producer.dispose();
        expect(active).toHaveBeenLastCalledWith(false);
    });
    it('subscribes before the activation snapshot and isolates client baselines', () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest.fn();
        const producer = createDevToolsUpdatePublisher({
            store,
            publish,
            onActiveChange: (active) => {
                if (active) store.setRoots([{ id: 'activated' }]);
            }
        });
        const first = producer.connect('first');
        expect(first.revision).toBe(1);
        store.setRoots([{ id: 'second-snapshot' }]);
        const second = producer.connect('second');
        producer.flush();
        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish.mock.calls[0][0]).toMatchObject({
            sessionId: 'first',
            baseRevision: 1,
            revision: 2
        });
        expect(producer.getRevision(second).revision).toBe(2);
        store.setRoots([{ id: 'third' }]);
        expect(producer.getSnapshot(second).revision).toBe(3);
        producer.flush();
        expect(publish).toHaveBeenCalledTimes(2);
        producer.disconnect(first);
        store.setRoots([{ id: 'fourth' }]);
        producer.flush();
        expect(publish.mock.calls[2][0].sessionId).toBe('second');
        producer.dispose();
    });
    it('cancels queued work on disconnect and starts a new stream on reconnect', () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest.fn();
        const active = jest.fn();
        const producer = createDevToolsUpdatePublisher({
            store,
            publish,
            onActiveChange: active
        });
        const old = producer.connect('panel');
        store.setRoots([{ id: 'queued' }]);
        producer.disconnect({ ...old, streamId: 'foreign' });
        expect(active).toHaveBeenCalledTimes(1);
        producer.disconnect(old);
        jest.advanceTimersByTime(100);
        expect(publish).not.toHaveBeenCalled();
        store.setRoots([{ id: 'changed-while-paused' }]);
        const fresh = producer.connect('panel');
        expect(fresh.streamId).not.toBe(old.streamId);
        expect(fresh.state.roots[0].id).toBe('changed-while-paused');
        producer.disconnect(old);
        expect(producer.getRevision(fresh).revision).toBe(0);
        expect(() => producer.getSnapshot(old)).toThrow('no longer active');
        producer.dispose();
        producer.dispose();
        producer.flush();
        expect(() => producer.connect('panel')).toThrow('disposed');
        expect(() => producer.getRevision(fresh)).toThrow('no longer active');
    });
    it('projects transport-safe metadata only and tolerates delivery failures', async () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest
            .fn()
            .mockImplementationOnce(() => {
                throw new Error('closed port');
            })
            .mockRejectedValueOnce(new Error('lost ack'))
            .mockResolvedValue(undefined);
        const producer = createDevToolsUpdatePublisher({
            store,
            publish,
            projectState: (state) => ({
                ...createInitialDevToolsCoreState(),
                roots: state.roots
            })
        });
        const initial = producer.connect('panel');
        store.setRoots([{ id: 'one' }]);
        expect(() => producer.flush()).not.toThrow();
        store.setRoots([{ id: 'two' }]);
        producer.flush();
        await Promise.resolve();
        expect(producer.getSnapshot(initial).state.roots[0].id).toBe('two');
        store.setRoots([{ id: 'three' }]);
        producer.flush();
        producer.dispose();
    });
    it('cleans activation failures and rejects missing identities', () => {
        const active = jest.fn((active: boolean) => {
            if (active) throw new Error('hook unavailable');
        });
        const producer = createDevToolsUpdatePublisher({
            store: createDevToolsCoreStateStore(),
            publish: jest.fn(),
            onActiveChange: active
        });
        expect(() => producer.connect('')).toThrow('identity');
        expect(() => producer.connect('panel')).toThrow('hook unavailable');
        expect(active).toHaveBeenLastCalledWith(false);
        expect(jest.getTimerCount()).toBe(0);
        producer.dispose();
    });
    it('invalidates removed and changed tree nodes without reading state values', () => {
        const store = createDevToolsCoreStateStore();
        const publish = jest.fn();
        store.setComponents([
            { id: 'old', displayName: 'Old', rootId: 'root' }
        ]);
        const producer = createDevToolsUpdatePublisher({ store, publish });
        producer.connect('panel');
        store.setComponents([
            { id: 'new', displayName: 'New', rootId: 'root' }
        ]);
        producer.flush();
        expect(publish.mock.calls[0][0].invalidatedComponents).toEqual([
            'old',
            'new'
        ]);
        producer.dispose();
    });
});
