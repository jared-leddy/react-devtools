import { createPageBackend } from '../src/pageBackend.js';
import { createExtensionServerChannel } from '@devtools/kit';
jest.mock('@devtools/kit', () => ({
    ...jest.requireActual('@devtools/kit'),
    createRpcServer: jest.fn(() => ({
        broadcast: { notifySessionUpdated: jest.fn(async () => {}) },
        dispose: jest.fn()
    }))
}));
describe('shared page backend', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });
    it('serves React hook renderers, roots, components, and component state from the user app RPC server', async () => {
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const { bootstrapUserAppRpcServer } = await Promise.resolve({
            bootstrapUserAppRpcServer: (
                target: Parameters<typeof createPageBackend>[0]
            ) => createPageBackend(target, createExtensionServerChannel())
        });

        const result = bootstrapUserAppRpcServer(target);
        const serverFunctions = createRpcServer.mock.calls.at(-1)?.[0];

        expect(result).toEqual({
            didOpenRpcServer: true,
            hookMode: 'wrapped',
            rendererCount: 1,
            rootCount: 1,
            dispose: expect.any(Function)
        });
        expect(createRpcServer).toHaveBeenLastCalledWith(serverFunctions, {
            channel: expect.any(Object),
            options: { timeout: 5000 },
            onDisconnect: expect.any(Function)
        });
        expect(serverFunctions.handshake({ clientId: 'panel' })).toMatchObject({
            capabilities: {
                roots: true,
                components: true,
                componentState: true
            },
            serverId: 'react-devtools-extension-user-app',
            state: {
                componentState: {},
                components: [expect.objectContaining({ displayName: 'App' })],
                renderers: [
                    expect.objectContaining({
                        id: 1,
                        packageName: 'react-dom',
                        targetId: 'top',
                        version: '19.1.1'
                    })
                ],
                roots: [
                    expect.objectContaining({
                        id: 'react-root:1',
                        targetId: 'top'
                    })
                ]
            }
        });
        expect(
            serverFunctions.getComponents({ rootId: 'react-root:1' })
        ).toEqual({
            components: [
                expect.objectContaining({
                    displayName: 'App',
                    id: 'react-root~3A1:0:FunctionComponent:App',
                    rootId: 'react-root:1',
                    type: 'function'
                })
            ]
        });
        expect(
            serverFunctions.getComponentState({
                componentId: 'react-root~3A1:0:FunctionComponent:App',
                rootId: 'react-root:1'
            })
        ).toMatchObject({
            componentId: 'react-root~3A1:0:FunctionComponent:App',
            rootId: 'react-root:1',
            sections: [
                {
                    fields: [{ name: 'title', value: 'Home' }],
                    name: 'props'
                },
                {
                    fields: [{ name: 'Hook 0 (state)', value: 1 }],
                    name: 'hooks'
                }
            ]
        });
        result.dispose?.();
    });
    it('coalesces commit bursts, preserves root metadata, lazily reads values, and stops on native disconnect', async () => {
        jest.useFakeTimers();
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const on = jest.spyOn(hook, 'on');
        const off = jest.spyOn(hook, 'off');
        const root = [
            ...hook.getFiberRoots(1)
        ][0] as import('../src/index.js').ReactFiberRoot;
        const readValue = jest.fn(() => 'on-demand');
        Object.defineProperty(root.current.child!.memoizedProps!, 'callback', {
            enumerable: true,
            get: readValue
        });
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const { bootstrapUserAppRpcServer } = await Promise.resolve({
            bootstrapUserAppRpcServer: (
                target: Parameters<typeof createPageBackend>[0]
            ) => createPageBackend(target, createExtensionServerChannel())
        });
        const result = bootstrapUserAppRpcServer(target);
        const functions = createRpcServer.mock.calls.at(-1)![0];
        const options = createRpcServer.mock.calls.at(-1)![1];
        const publish = createRpcServer.mock.results.at(-1)!.value.broadcast
            .notifySessionUpdated as jest.Mock;
        expect(on).not.toHaveBeenCalled();
        const initial = functions.handshake({ clientId: 'panel' });
        expect(on).toHaveBeenCalledTimes(4);
        for (let count = 0; count < 20; count++)
            hook.emit('commit-fiber-root', { rendererID: 1, root });
        hook.emit('post-commit-fiber-root', { rendererID: 1, root });
        jest.advanceTimersByTime(16);
        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish.mock.calls[0][0]).toMatchObject({
            baseRevision: initial.revision,
            sessionId: 'panel',
            streamId: initial.streamId,
            patch: {
                roots: [
                    expect.objectContaining({ rendererId: 1, commitCount: 20 })
                ]
            }
        });
        expect(publish.mock.calls[0][0].patch).not.toHaveProperty(
            'componentState'
        );
        expect(readValue).not.toHaveBeenCalled();
        functions.getComponentState({
            componentId: 'react-root~3A1:0:FunctionComponent:App',
            rootId: 'react-root:1'
        });
        expect(readValue).toHaveBeenCalledTimes(1);
        expect(
            functions.getComponentState({
                componentId: 'react-root~3A1:0:FunctionComponent:App',
                rootId: 'wrong-root'
            })
        ).toBeUndefined();
        options.onDisconnect();
        expect(off).toHaveBeenCalledTimes(4);
        hook.emit('commit-fiber-root', { rendererID: 1, root });
        jest.advanceTimersByTime(100);
        expect(publish).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
        const fresh = functions.handshake({ clientId: 'new-panel' });
        expect(fresh.streamId).not.toBe(initial.streamId);
        expect(() => functions.getSessionSnapshot(initial)).toThrow(
            'no longer active'
        );
        functions.disconnectSession(fresh);
        expect(off).toHaveBeenCalledTimes(8);
        result.dispose?.();
    });
    it('keeps a root when a child unmounts and removes it only for an actual root unmount', async () => {
        jest.useFakeTimers();
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const { bootstrapUserAppRpcServer } = await Promise.resolve({
            bootstrapUserAppRpcServer: (
                target: Parameters<typeof createPageBackend>[0]
            ) => createPageBackend(target, createExtensionServerChannel())
        });
        const result = bootstrapUserAppRpcServer(target);
        const functions = createRpcServer.mock.calls.at(-1)![0];
        const initial = functions.handshake({ clientId: 'panel' });
        const root = [
            ...hook.getFiberRoots(1)
        ][0] as import('../src/index.js').ReactFiberRoot;
        hook.emit('renderer', { id: 1, renderer: {} });
        hook.emit('commit-fiber-unmount', {
            rendererID: 1,
            fiber: root.current.child
        });
        jest.advanceTimersByTime(16);
        expect(functions.getSessionSnapshot(initial).state.roots).toHaveLength(
            1
        );
        functions.selectRoot('react-root:1');
        functions.selectComponent('react-root~3A1:0:FunctionComponent:App');
        root.current.memoizedState = { element: null };
        hook.emit('commit-fiber-root', { rendererID: 1, root });
        jest.advanceTimersByTime(16);
        expect(functions.getSessionSnapshot(initial).state.roots).toEqual([]);
        expect(
            functions.getSessionSnapshot(initial).state.selectedRootId
        ).toBeNull();
        expect(
            functions.getSessionSnapshot(initial).state.selectedComponentId
        ).toBeNull();
        hook.emit('commit-fiber-root', { rendererID: 1, root });
        jest.advanceTimersByTime(16);
        expect(functions.getSessionSnapshot(initial).state.roots).toEqual([]);
        result.dispose?.();
    });
    it('preserves multiple renderer links through later commits and post-commit refresh', async () => {
        jest.useFakeTimers();
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const { bootstrapUserAppRpcServer } = await Promise.resolve({
            bootstrapUserAppRpcServer: (
                target: Parameters<typeof createPageBackend>[0]
            ) => createPageBackend(target, createExtensionServerChannel())
        });
        const result = bootstrapUserAppRpcServer(target);
        const functions = createRpcServer.mock.calls.at(-1)![0];
        const initial = functions.handshake({ clientId: 'panel' });
        const first = [...hook.getFiberRoots(1)][0];
        const second = [...createMockReactHook().getFiberRoots(1)][0];
        hook.renderers.set(2, {
            bundleType: 1,
            rendererPackageName: 'react-dom',
            version: '19.1.1'
        });
        hook.emit('renderer', { id: 2 });
        hook.emit('commit-fiber-root', { rendererID: 2, root: second });
        hook.emit('post-commit-fiber-root', { rendererID: 1, root: first });
        jest.advanceTimersByTime(16);
        expect(functions.getSessionSnapshot(initial).state.roots).toEqual([
            expect.objectContaining({ id: 'react-root:1', rendererId: 1 }),
            expect.objectContaining({ id: 'react-root:2', rendererId: 2 })
        ]);
        result.dispose?.();
    });
});
function createMockUserAppWindow() {
    return {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        removeEventListener: jest.fn()
    } as unknown as Parameters<typeof createPageBackend>[0] & {
        __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    };
}

function createMockReactHook() {
    const { ReactFiberTag } = jest.requireActual(
        '../src/index.js'
    ) as typeof import('../src/index.js');
    function App() {}
    function basicStateReducer() {}

    const hostRoot = createMockFiber({
        tag: ReactFiberTag.HostRoot,
        type: null
    });
    const app = createMockFiber({
        memoizedProps: { title: 'Home' },
        memoizedState: {
            memoizedState: 1,
            next: null,
            queue: { lastRenderedReducer: basicStateReducer }
        },
        returnFiber: hostRoot,
        tag: ReactFiberTag.FunctionComponent,
        type: App
    });
    hostRoot.child = app;

    const root = {
        current: hostRoot,
        identifierPrefix: 'test'
    };
    const listeners = new Map<string, Set<(payload: unknown) => void>>();

    return {
        emit(event: string, payload: unknown) {
            for (const listener of listeners.get(event) ?? []) {
                listener(payload);
            }
        },
        getFiberRoots(rendererId: number) {
            return rendererId === 1 ? new Set([root]) : new Set();
        },
        inject: jest.fn(() => 1),
        off(event: string, listener: (payload: unknown) => void) {
            listeners.get(event)?.delete(listener);
        },
        on(event: string, listener: (payload: unknown) => void) {
            let eventListeners = listeners.get(event);

            if (!eventListeners) {
                eventListeners = new Set();
                listeners.set(event, eventListeners);
            }

            eventListeners.add(listener);
        },
        once: jest.fn(),
        onCommitFiberRoot: jest.fn(),
        onCommitFiberUnmount: jest.fn(),
        onPostCommitFiberRoot: jest.fn(),
        rendererInterfaces: new Map([[1, { renderer: {} }]]),
        renderers: new Map([
            [
                1,
                {
                    bundleType: 1,
                    rendererPackageName: 'react-dom',
                    version: '19.1.1'
                }
            ]
        ]),
        sub: jest.fn(),
        supportsFiber: true
    };
}

function createMockFiber({
    memoizedProps = null,
    memoizedState = null,
    returnFiber = null,
    tag,
    type
}: {
    memoizedProps?: unknown;
    memoizedState?: unknown;
    returnFiber?: null | Record<string, unknown>;
    tag: number;
    type: unknown;
}): Record<string, unknown> {
    return {
        alternate: null,
        child: null,
        elementType: type,
        flags: 0,
        index: 0,
        key: null,
        memoizedProps,
        memoizedState,
        mode: 0,
        pendingProps: null,
        return: returnFiber,
        sibling: null,
        stateNode: null,
        tag,
        type
    };
}
