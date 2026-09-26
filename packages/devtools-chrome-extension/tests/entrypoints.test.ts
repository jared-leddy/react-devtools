describe('extension entrypoints', () => {
    afterEach(() => {
        delete (
            window as Window & {
                __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
            }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        jest.restoreAllMocks();
        jest.resetModules();
    });

    it('registers service worker lifecycle listeners', async () => {
        const addEventListener = jest.spyOn(self, 'addEventListener');

        await import('../src/background');

        expect(addEventListener).toHaveBeenCalledWith(
            'install',
            expect.any(Function)
        );
        expect(addEventListener).toHaveBeenCalledWith(
            'activate',
            expect.any(Function)
        );

        for (const [, listener] of addEventListener.mock.calls) {
            if (typeof listener === 'function') {
                listener(new Event('test'));
            }
        }
    });

    it('announces the MAIN-world prepare script readiness', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../src/content/prepare');

        expect(window).toHaveProperty('__REACT_DEVTOOLS_GLOBAL_HOOK__');
        expect(
            (
                window as Window & {
                    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
                        inject?: unknown;
                        supportsFiber?: unknown;
                    };
                }
            ).__REACT_DEVTOOLS_GLOBAL_HOOK__
        ).toEqual(
            expect.objectContaining({
                inject: expect.any(Function),
                supportsFiber: true
            })
        );
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    mode: 'installed',
                    reason: undefined,
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('installs a usable MAIN-world React hook before announcing readiness', async () => {
        const order: string[] = [];
        const onReady = jest.fn(() => {
            expect(window).toHaveProperty('__REACT_DEVTOOLS_GLOBAL_HOOK__');
            order.push('ready');
        });
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../src/content/prepare');

        const hook = (
            window as unknown as Window & {
                __REACT_DEVTOOLS_GLOBAL_HOOK__: {
                    emit: (event: string, payload: unknown) => void;
                    getFiberRoots: (rendererID: number) => Set<unknown>;
                    inject: (renderer: Record<string, unknown>) => number;
                    off: (
                        event: string,
                        listener: (payload: unknown) => void
                    ) => void;
                    on: (
                        event: string,
                        listener: (payload: unknown) => void
                    ) => void;
                    once: (
                        event: string,
                        listener: (payload: unknown) => void
                    ) => void;
                    onCommitFiberRoot: (
                        rendererID: number,
                        root: Record<string, unknown>,
                        priorityLevel?: unknown,
                        didError?: boolean
                    ) => void;
                    onCommitFiberUnmount: (
                        rendererID: number,
                        fiber: Record<string, unknown>
                    ) => void;
                    onPostCommitFiberRoot: (
                        rendererID: number,
                        root: Record<string, unknown>
                    ) => void;
                    sub: (
                        event: string,
                        listener: (payload: unknown) => void
                    ) => () => void;
                };
            }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const renderer = { rendererPackageName: 'react-dom' };
        const root = { current: {} };
        const fiber = { tag: 0 };
        const rendererListener = jest.fn();
        const attachedListener = jest.fn();
        const commitListener = jest.fn();
        const subscribedCommitListener = jest.fn();
        const onceCommitListener = jest.fn();
        const postCommitListener = jest.fn();
        const unmountListener = jest.fn();
        const removedListener = jest.fn();

        hook.on('renderer', rendererListener);
        hook.on('renderer-attached', attachedListener);
        hook.on('commit-fiber-root', commitListener);
        hook.once('commit-fiber-root', onceCommitListener);
        hook.on('post-commit-fiber-root', postCommitListener);
        hook.on('commit-fiber-unmount', unmountListener);
        hook.on('renderer', removedListener);
        hook.off('renderer', removedListener);

        const rendererID = hook.inject(renderer);
        const unsubscribe = hook.sub(
            'commit-fiber-root',
            subscribedCommitListener
        );
        hook.onCommitFiberRoot(rendererID, root, 'normal-priority', false);
        unsubscribe();
        hook.onCommitFiberRoot(rendererID, root);
        hook.onPostCommitFiberRoot(rendererID, root);
        hook.onCommitFiberUnmount(rendererID, fiber);
        hook.emit('post-commit-fiber-root', { rendererID, root });

        expect(order).toEqual(['ready']);
        expect(rendererID).toBe(1);
        expect(hook.getFiberRoots(rendererID).has(root)).toBe(true);
        expect(rendererListener).toHaveBeenCalledWith({
            id: rendererID,
            renderer
        });
        expect(attachedListener).toHaveBeenCalledWith({
            id: rendererID,
            rendererInterface: { renderer }
        });
        expect(commitListener).toHaveBeenCalledTimes(2);
        expect(subscribedCommitListener).toHaveBeenCalledTimes(1);
        expect(onceCommitListener).toHaveBeenCalledTimes(1);
        expect(postCommitListener).toHaveBeenCalledTimes(2);
        expect(unmountListener).toHaveBeenCalledWith({ fiber, rendererID });
        expect(removedListener).not.toHaveBeenCalled();
    });

    it('wraps an existing compatible MAIN-world React hook', async () => {
        const renderer = { rendererPackageName: 'react-dom' };
        const rendererInterfaces = new Map([[7, { renderer }]]);
        const existingHook = {
            emit: jest.fn(),
            getFiberRoots: jest.fn(() => new Set()),
            inject: jest.fn((_renderer: Record<string, unknown>) => 7),
            off: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            onCommitFiberRoot: jest.fn(),
            onCommitFiberUnmount: jest.fn(),
            onPostCommitFiberRoot: jest.fn(),
            rendererInterfaces,
            renderers: new Map(),
            sub: jest.fn(),
            supportsFiber: true
        };
        Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
            configurable: true,
            enumerable: false,
            value: existingHook
        });
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../src/content/prepare');

        const hook = (
            window as unknown as Window & {
                __REACT_DEVTOOLS_GLOBAL_HOOK__: typeof existingHook;
            }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const root = { current: {} };
        const fiber = { tag: 0 };

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    mode: 'wrapped',
                    reason: undefined,
                    source: 'react-devtools-extension'
                }
            })
        );

        expect(hook.inject(renderer)).toBe(7);
        hook.onCommitFiberRoot(7, root, 'normal-priority', true);
        hook.onCommitFiberUnmount(7, fiber);
        hook.onPostCommitFiberRoot(7, root);

        expect(existingHook.emit).toHaveBeenCalledWith('renderer', {
            id: 7,
            renderer
        });
        expect(existingHook.emit).toHaveBeenCalledWith('renderer-attached', {
            id: 7,
            rendererInterface: { renderer }
        });
        expect(existingHook.emit).toHaveBeenCalledWith('commit-fiber-root', {
            didError: true,
            priorityLevel: 'normal-priority',
            rendererID: 7,
            root
        });
        expect(existingHook.emit).toHaveBeenCalledWith('commit-fiber-unmount', {
            fiber,
            rendererID: 7
        });
        expect(existingHook.emit).toHaveBeenCalledWith(
            'post-commit-fiber-root',
            { rendererID: 7, root }
        );
    });

    it('reports disabled mode when another incompatible hook is already present', async () => {
        Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
            configurable: true,
            enumerable: false,
            value: { supportsFiber: false }
        });
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../src/content/prepare');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    mode: 'disabled',
                    reason: 'Existing __REACT_DEVTOOLS_GLOBAL_HOOK__ is not compatible with React Fiber devtools.',
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('announces the isolated-world proxy script readiness', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_proxy_ready__', onReady);

        await import('../src/content/proxy');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('announces the DevTools page bootstrap readiness', async () => {
        const onReady = jest.fn();
        globalThis.addEventListener(
            '__react_devtools_devtools_page_ready__',
            onReady
        );

        await import('../src/devtools');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });
});
