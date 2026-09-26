jest.mock('@devtools/client', () => ({
    mountDevToolsClient: jest.fn()
}));

jest.mock('@devtools/client/style.css', () => ({}), { virtual: true });

jest.mock('@devtools/core', () => ({
    ...jest.requireActual('@devtools/core'),
    createDevToolsCoreClient: jest.fn()
}));

jest.mock('@devtools/kit', () => ({
    ...jest.requireActual('@devtools/kit'),
    createRpcServer: jest.fn()
}));

describe('extension entrypoints', () => {
    afterEach(() => {
        delete (
            window as Window & {
                __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
            }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
        document.body.innerHTML = '';
        jest.useRealTimers();
        jest.restoreAllMocks();
        jest.resetModules();
    });

    it('registers service worker lifecycle listeners', async () => {
        const addEventListener = jest.spyOn(self, 'addEventListener');
        const chrome = createMockBackgroundChrome();
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;

        const background = await import('../src/background');

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

        expect(chrome.runtimeMessageListeners).toHaveLength(1);
        chrome.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            { tab: { id: 42 } }
        );
        chrome.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'ignored'
            },
            { tab: { id: 99 } }
        );

        expect(background.hasDetectedReactInTab(42)).toBe(true);
        expect(background.hasDetectedReactInTab(99)).toBe(false);
        expect(chrome.action.setPopup).toHaveBeenCalledWith({
            popup: 'popup.html',
            tabId: 42
        });
        expect(chrome.action.setTitle).toHaveBeenCalledWith({
            tabId: 42,
            title: 'React DevTools - React detected'
        });
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
            tabId: 42,
            text: 'R'
        });
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
            color: '#149eca',
            tabId: 42
        });
    });

    it('relays background ports only within the same tab', async () => {
        const chrome = createMockBackgroundChrome();
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;

        await import('../src/background');

        const tabOnePanelPort = createMockBackgroundPort('101');
        const tabOnePagePort = createMockBackgroundPort('content-script', 101);
        const tabTwoPanelPort = createMockBackgroundPort('202');
        const tabTwoPagePort = createMockBackgroundPort('content-script', 202);

        chrome.connect(tabOnePanelPort);
        chrome.connect(tabTwoPanelPort);
        chrome.connect(tabOnePagePort);
        chrome.connect(tabTwoPagePort);

        tabOnePanelPort.emitMessage({ from: 'panel-101' });
        tabOnePagePort.emitMessage({ from: 'page-101' });
        tabTwoPanelPort.emitMessage({ from: 'panel-202' });
        tabTwoPagePort.emitMessage({ from: 'page-202' });

        expect(tabOnePagePort.sentMessages).toEqual([{ from: 'panel-101' }]);
        expect(tabOnePanelPort.sentMessages).toEqual([{ from: 'page-101' }]);
        expect(tabTwoPagePort.sentMessages).toEqual([{ from: 'panel-202' }]);
        expect(tabTwoPanelPort.sentMessages).toEqual([{ from: 'page-202' }]);
    });

    it('cleans background tab state on disconnect, close, and navigation', async () => {
        const chrome = createMockBackgroundChrome();
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;

        const background = await import('../src/background');
        const panelPort = createMockBackgroundPort('101');
        const pagePort = createMockBackgroundPort('content-script', 101);

        chrome.connect(panelPort);
        chrome.connect(pagePort);
        expect(background.hasPortsForTab(101)).toBe(true);

        panelPort.disconnect();
        expect(background.hasPortsForTab(101)).toBe(true);

        pagePort.disconnect();
        expect(background.hasPortsForTab(101)).toBe(false);

        chrome.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            { tab: { id: 101 } }
        );
        expect(background.hasDetectedReactInTab(101)).toBe(true);

        chrome.removeTab(101);
        expect(background.hasDetectedReactInTab(101)).toBe(false);
        expect(chrome.action.setPopup).toHaveBeenLastCalledWith({
            popup: '',
            tabId: 101
        });
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            tabId: 101,
            text: ''
        });

        chrome.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            { tab: { id: 202 } }
        );
        expect(background.hasDetectedReactInTab(202)).toBe(true);

        chrome.updateTab(202, { status: 'loading' });
        expect(background.hasDetectedReactInTab(202)).toBe(false);
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

    it('detects React when the MAIN-world hook has a registered renderer', async () => {
        const { hasDetectedReact } = await import('../src/content/detector');

        expect(
            hasDetectedReact({
                renderers: new Map([[1, { rendererPackageName: 'react-dom' }]]),
                supportsFiber: true
            })
        ).toBe(true);
        expect(
            hasDetectedReact({
                rendererInterfaces: new Map([
                    [1, { renderer: { rendererPackageName: 'react-dom' } }]
                ]),
                supportsFiber: true
            })
        ).toBe(true);
        expect(hasDetectedReact(undefined)).toBe(false);
        expect(
            hasDetectedReact({
                renderers: new Map(),
                supportsFiber: true
            })
        ).toBe(false);
        expect(
            hasDetectedReact({
                renderers: new Map([[1, {}]]),
                supportsFiber: false
            })
        ).toBe(false);
    });

    it('posts a MAIN-world React detection message after renderer registration', async () => {
        const postedMessages: unknown[] = [];
        jest.spyOn(window, 'postMessage').mockImplementation((message) => {
            postedMessages.push(message);
        });

        await import('../src/content/prepare');
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_detector_ready__', onReady);

        await import('../src/content/detector');

        const hook = (
            window as unknown as Window & {
                __REACT_DEVTOOLS_GLOBAL_HOOK__: {
                    inject: (renderer: Record<string, unknown>) => number;
                };
            }
        ).__REACT_DEVTOOLS_GLOBAL_HOOK__;

        expect(postedMessages).toEqual([]);

        hook.inject({ rendererPackageName: 'react-dom' });
        hook.inject({ rendererPackageName: 'react-dom' });

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
        expect(postedMessages).toEqual([
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            }
        ]);
    });

    it('announces the isolated-world proxy script readiness', async () => {
        const sentMessages: unknown[] = [];
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
            runtime: {
                sendMessage(message: unknown) {
                    sentMessages.push(message);
                }
            }
        };
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_proxy_ready__', onReady);

        await import('../src/content/proxy');

        window.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    source: 'react-devtools-extension',
                    type: 'react-devtools:react-detected'
                }
            })
        );
        window.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    source: 'react-devtools-extension',
                    type: 'ignored'
                }
            })
        );

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
        expect(sentMessages).toEqual([
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            }
        ]);
    });

    it('creates the DevTools panel once React is detected in the inspected window', async () => {
        jest.useFakeTimers();
        const chrome = createMockDevToolsChrome([false, true]);
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;
        const onReady = jest.fn();
        globalThis.addEventListener(
            '__react_devtools_devtools_page_ready__',
            onReady
        );

        await import('../src/devtools-background');

        expect(chrome.inspectedWindow.eval).toHaveBeenCalledTimes(1);
        expect(chrome.panels.create).not.toHaveBeenCalled();

        jest.advanceTimersByTime(250);

        expect(chrome.inspectedWindow.eval).toHaveBeenCalledTimes(2);
        expect(chrome.panels.create).toHaveBeenCalledWith(
            'React',
            '',
            'devtools-panel.html'
        );
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('stops polling the inspected window when React is not detected', async () => {
        jest.useFakeTimers();
        const chrome = createMockDevToolsChrome([false, false, false]);
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;

        const { DEFAULT_MAX_DETECTION_ATTEMPTS } =
            await import('../src/devtools-background');

        jest.advanceTimersByTime(250 * DEFAULT_MAX_DETECTION_ATTEMPTS);

        expect(chrome.inspectedWindow.eval).toHaveBeenCalledTimes(
            DEFAULT_MAX_DETECTION_ATTEMPTS
        );
        expect(chrome.panels.create).not.toHaveBeenCalled();
    });

    it('bootstraps the DevTools panel client and inspected-page user app', async () => {
        document.body.innerHTML = '<div id="root"></div>';
        const chrome = createMockDevToolsPanelChrome();
        (globalThis as typeof globalThis & { chrome?: unknown }).chrome =
            chrome.api;
        const onReady = jest.fn();
        globalThis.addEventListener('__react_devtools_panel_ready__', onReady);

        await import('../src/devtools-panel');
        const { mountDevToolsClient } = jest.requireMock(
            '@devtools/client'
        ) as {
            mountDevToolsClient: jest.Mock;
        };
        const { createDevToolsCoreClient } = jest.requireMock(
            '@devtools/core'
        ) as {
            createDevToolsCoreClient: jest.Mock;
        };

        expect(chrome.runtime.getURL).toHaveBeenCalledWith('user-app.js');
        expect(chrome.inspectedWindow.eval).toHaveBeenCalledWith(
            expect.stringContaining(
                'chrome-extension://react-devtools/user-app.js'
            )
        );
        expect(chrome.inspectedWindow.eval).toHaveBeenCalledWith(
            expect.stringContaining('__react-devtools-user-app__')
        );
        expect(mountDevToolsClient).toHaveBeenCalledWith(
            document.getElementById('root')
        );
        expect(createDevToolsCoreClient).toHaveBeenCalledWith({
            preset: 'extension'
        });
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    didInjectUserApp: true,
                    didMountClient: true,
                    didOpenRpcClient: true,
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('announces the inspected-page user app readiness', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_user_app_ready__', onReady);

        await import('../src/content/user-app');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    didOpenRpcServer: true,
                    source: 'react-devtools-extension'
                })
            })
        );
    });

    it('serves React hook renderers, roots, components, and component state from the user app RPC server', async () => {
        const target = createMockUserAppWindow();
        const hook = createMockReactHook();
        target.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        const { createRpcServer } = jest.requireMock('@devtools/kit') as {
            createRpcServer: jest.Mock;
        };
        const { bootstrapUserAppRpcServer } =
            await import('../src/content/user-app');

        const result = bootstrapUserAppRpcServer(target);
        const serverFunctions = createRpcServer.mock.calls.at(-1)?.[0];

        expect(result).toEqual({
            didOpenRpcServer: true,
            hookMode: 'wrapped',
            rendererCount: 1,
            rootCount: 1
        });
        expect(createRpcServer).toHaveBeenLastCalledWith(serverFunctions, {
            preset: 'extension'
        });
        expect(serverFunctions.handshake({ clientId: 'panel' })).toMatchObject({
            serverId: 'react-devtools-extension-user-app',
            state: {
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
    });
});

function createMockDevToolsChrome(detectionResults: boolean[]) {
    const inspectedWindow = {
        eval: jest.fn(
            (_expression: string, callback: (result: unknown) => void) => {
                callback(detectionResults.shift() ?? false);
            }
        )
    };
    const panels = {
        create: jest.fn()
    };

    return {
        api: {
            devtools: {
                inspectedWindow,
                panels
            }
        },
        inspectedWindow,
        panels
    };
}

function createMockDevToolsPanelChrome() {
    const inspectedWindow = {
        eval: jest.fn()
    };
    const runtime = {
        getURL: jest.fn(
            (path: string) => `chrome-extension://react-devtools/${path}`
        )
    };

    return {
        api: {
            devtools: {
                inspectedWindow
            },
            runtime
        },
        inspectedWindow,
        runtime
    };
}

function createMockUserAppWindow() {
    return {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        removeEventListener: jest.fn()
    } as unknown as Window & {
        __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    };
}

function createMockReactHook() {
    const { ReactFiberTag } = jest.requireActual(
        '@devtools/core'
    ) as typeof import('@devtools/core');
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

interface MockBackgroundPort {
    disconnect(): void;
    emitMessage(message: unknown): void;
    name: string;
    onDisconnect: MockExtensionEvent<() => void>;
    onMessage: MockExtensionEvent<(message: unknown) => void>;
    postMessage(message: unknown): void;
    sender?: unknown;
    sentMessages: unknown[];
}

interface MockExtensionEvent<Handler extends (...args: never[]) => void> {
    addListener(handler: Handler): void;
    removeListener(handler: Handler): void;
}

function createMockBackgroundChrome() {
    const runtimeMessageListeners: Array<
        (message: unknown, sender?: unknown) => void
    > = [];
    const connectListeners: Array<(port: MockBackgroundPort) => void> = [];
    const removedListeners: Array<(tabId: number) => void> = [];
    const updatedListeners: Array<
        (tabId: number, changeInfo?: unknown) => void
    > = [];
    const action = {
        setBadgeBackgroundColor: jest.fn(),
        setBadgeText: jest.fn(),
        setPopup: jest.fn(),
        setTitle: jest.fn()
    };

    return {
        action,
        api: {
            action,
            runtime: {
                onConnect: {
                    addListener(listener: (port: MockBackgroundPort) => void) {
                        connectListeners.push(listener);
                    }
                },
                onMessage: {
                    addListener(
                        listener: (message: unknown, sender?: unknown) => void
                    ) {
                        runtimeMessageListeners.push(listener);
                    }
                }
            },
            tabs: {
                onRemoved: {
                    addListener(listener: (tabId: number) => void) {
                        removedListeners.push(listener);
                    }
                },
                onUpdated: {
                    addListener(
                        listener: (tabId: number, changeInfo?: unknown) => void
                    ) {
                        updatedListeners.push(listener);
                    }
                }
            }
        },
        connect(port: MockBackgroundPort) {
            for (const listener of connectListeners) {
                listener(port);
            }
        },
        emitRuntimeMessage(message: unknown, sender?: unknown) {
            for (const listener of runtimeMessageListeners) {
                listener(message, sender);
            }
        },
        removeTab(tabId: number) {
            for (const listener of removedListeners) {
                listener(tabId);
            }
        },
        runtimeMessageListeners,
        updateTab(tabId: number, changeInfo?: unknown) {
            for (const listener of updatedListeners) {
                listener(tabId, changeInfo);
            }
        }
    };
}

function createMockBackgroundPort(
    name: string,
    tabId?: number
): MockBackgroundPort {
    const messageListeners = new Set<(message: unknown) => void>();
    const disconnectListeners = new Set<() => void>();
    const port: MockBackgroundPort = {
        disconnect() {
            for (const listener of disconnectListeners) {
                listener();
            }
        },
        emitMessage(message) {
            for (const listener of messageListeners) {
                listener(message);
            }
        },
        name,
        onDisconnect: {
            addListener(listener) {
                disconnectListeners.add(listener);
            },
            removeListener(listener) {
                disconnectListeners.delete(listener);
            }
        },
        onMessage: {
            addListener(listener) {
                messageListeners.add(listener);
            },
            removeListener(listener) {
                messageListeners.delete(listener);
            }
        },
        postMessage(message) {
            port.sentMessages.push(message);
        },
        sentMessages: []
    };

    if (tabId !== undefined) {
        port.sender = { tab: { id: tabId } };
    }

    return port;
}
