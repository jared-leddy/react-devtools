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
    it('pushes context metadata without raw values and inspects them only on demand', () => {
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const root = [
            ...hook.getFiberRoots(1)
        ][0] as import('../src/index.js').ReactFiberRoot;
        root.current.child!.dependencies = {
            firstContext: {
                context: { displayName: 'ObservedTheme' },
                memoizedValue: { marker: 'observed-context-value' },
                next: null
            }
        };
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const backend = createPageBackend(
            target,
            createExtensionServerChannel()
        );
        const functions = createRpcServer.mock.calls.at(-1)![0];
        const response = functions.handshake({ clientId: 'metadata-only' });
        expect(JSON.stringify(response)).not.toContain(
            'observed-context-value'
        );
        const id = functions.getComponents({ rootId: 'react-root:1' })
            .components[0].id;
        const inspection = functions.getComponentState({
            rootId: 'react-root:1',
            componentId: id
        });
        expect(JSON.stringify(inspection.sections)).toContain(
            'observed-context-value'
        );
        expect(inspection.editing).toEqual({
            props: false,
            hooks: false,
            state: false,
            context: false
        });
        backend.dispose?.();
    });
    it('roundtrips observed DOM bounds, rejects wrong roots, and retires removed selections and highlights', () => {
        jest.useFakeTimers();
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const root = [
            ...hook.getFiberRoots(1)
        ][0] as import('../src/index.js').ReactFiberRoot;
        const app = root.current.child!;
        app.child = {
            ...app,
            tag: 5,
            type: 'article',
            child: null,
            sibling: null,
            return: app,
            stateNode: {
                nodeType: 1,
                tagName: 'ARTICLE',
                getBoundingClientRect: () => ({
                    x: 10,
                    y: 20,
                    width: 30,
                    height: 40
                })
            }
        };
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const backend = createPageBackend(
            target,
            createExtensionServerChannel()
        );
        const functions = createRpcServer.mock.calls.at(-1)![0];
        const session = functions.handshake({ clientId: 'identity-test' });
        const id = functions.getComponents({ rootId: 'react-root:1' })
            .components[0].id;
        expect(
            functions.getComponentState({
                rootId: 'react-root:1',
                componentId: id
            })
        ).toMatchObject({ domRect: { x: 10, y: 20, width: 30, height: 40 } });
        functions.selectComponent(id);
        functions.highlightComponent({
            rootId: 'react-root:1',
            componentId: id
        });
        expect(
            functions.highlightComponent({
                rootId: 'other-root',
                componentId: id
            }).highlightedComponentId
        ).toBeNull();
        functions.highlightComponent({
            rootId: 'react-root:1',
            componentId: id
        });
        root.current.child = null;
        hook.emit('commit-fiber-root', { rendererID: 1, root });
        jest.advanceTimersByTime(16);
        const state = functions.getSessionSnapshot(session).state;
        expect(state.selectedComponentId).toBeNull();
        expect(state.highlightedComponentId).toBeNull();
        expect(
            functions.getComponentState({
                rootId: 'react-root:1',
                componentId: id
            })
        ).toBeUndefined();
        backend.dispose?.();
    });
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
                    id: expect.stringMatching(/^c:[0-9a-f-]{36}:[0-9a-z]+$/),
                    rootId: 'react-root:1',
                    type: 'function'
                })
            ]
        });
        expect(
            serverFunctions.getComponentState({
                componentId: serverFunctions.getComponents({
                    rootId: 'react-root:1'
                }).components[0].id,
                rootId: 'react-root:1'
            })
        ).toMatchObject({
            componentId: serverFunctions.getComponents({
                rootId: 'react-root:1'
            }).components[0].id,
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
            componentId: functions.getComponents({ rootId: 'react-root:1' })
                .components[0].id,
            rootId: 'react-root:1'
        });
        expect(readValue).not.toHaveBeenCalled();
        expect(
            functions.getComponentState({
                componentId: functions.getComponents({ rootId: 'react-root:1' })
                    .components[0].id,
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
        functions.selectComponent(
            functions.getComponents({ rootId: 'react-root:1' }).components[0].id
        );
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
