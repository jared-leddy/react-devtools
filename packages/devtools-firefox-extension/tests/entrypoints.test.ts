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
        delete (globalThis as typeof globalThis & { browser?: unknown })
            .browser;
        delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
        document.body.innerHTML = '';
        jest.useRealTimers();
        jest.restoreAllMocks();
        jest.resetModules();
    });

    it('registers background listeners, toolbar detection, and tab cleanup', async () => {
        const addEventListener = jest.spyOn(self, 'addEventListener');
        const browser = createMockBackgroundBrowser();
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;

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

        browser.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            { tab: { id: 42 } }
        );
        browser.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'ignored'
            },
            { tab: { id: 99 } }
        );

        expect(background.hasDetectedReactInTab(42)).toBe(true);
        expect(background.hasDetectedReactInTab(99)).toBe(false);
        expect(browser.browserAction.setPopup).toHaveBeenCalledWith({
            popup: 'popup.html',
            tabId: 42
        });
        expect(browser.browserAction.setTitle).toHaveBeenCalledWith({
            tabId: 42,
            title: 'React DevTools - React detected'
        });
        expect(browser.browserAction.setBadgeText).toHaveBeenCalledWith({
            tabId: 42,
            text: 'R'
        });
        expect(
            browser.browserAction.setBadgeBackgroundColor
        ).toHaveBeenCalledWith({
            color: '#149eca',
            tabId: 42
        });

        browser.removeTab(42);
        expect(background.hasDetectedReactInTab(42)).toBe(false);
        expect(browser.browserAction.setPopup).toHaveBeenLastCalledWith({
            popup: '',
            tabId: 42
        });
        expect(browser.browserAction.setBadgeText).toHaveBeenLastCalledWith({
            tabId: 42,
            text: ''
        });
    });

    it('relays background ports only within the same tab', async () => {
        const browser = createMockBackgroundBrowser();
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;

        await import('../src/background');

        const tabOnePanelPort = createMockBackgroundPort('101');
        const tabOnePagePort = createMockBackgroundPort('content-script', 101);
        const tabTwoPanelPort = createMockBackgroundPort('202');
        const tabTwoPagePort = createMockBackgroundPort('content-script', 202);

        browser.connect(tabOnePanelPort);
        browser.connect(tabTwoPanelPort);
        browser.connect(tabOnePagePort);
        browser.connect(tabTwoPagePort);

        tabOnePanelPort.emitMessage({ from: 'panel-101' });
        tabOnePagePort.emitMessage({ from: 'page-101' });
        tabTwoPanelPort.emitMessage({ from: 'panel-202' });
        tabTwoPagePort.emitMessage({ from: 'page-202' });

        expect(tabOnePagePort.sentMessages).toEqual([{ from: 'panel-101' }]);
        expect(tabOnePanelPort.sentMessages).toEqual([{ from: 'page-101' }]);
        expect(tabTwoPagePort.sentMessages).toEqual([{ from: 'panel-202' }]);
        expect(tabTwoPanelPort.sentMessages).toEqual([{ from: 'page-202' }]);
    });

    it('cleans background port state on disconnect and navigation', async () => {
        const browser = createMockBackgroundBrowser();
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;

        const background = await import('../src/background');
        const panelPort = createMockBackgroundPort('101');
        const pagePort = createMockBackgroundPort('content-script', 101);

        browser.connect(panelPort);
        browser.connect(pagePort);
        expect(background.hasPortsForTab(101)).toBe(true);

        panelPort.disconnect();
        expect(background.hasPortsForTab(101)).toBe(true);

        pagePort.disconnect();
        expect(background.hasPortsForTab(101)).toBe(false);

        browser.emitRuntimeMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            { tab: { id: 202 } }
        );
        expect(background.hasDetectedReactInTab(202)).toBe(true);

        browser.updateTab(202, { status: 'loading' });
        expect(background.hasDetectedReactInTab(202)).toBe(false);
    });

    it('loads the shared MAIN-world prepare script', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../../devtools-chrome-extension/src/content/prepare');

        expect(window).toHaveProperty('__REACT_DEVTOOLS_GLOBAL_HOOK__');
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

    it('injects Firefox page-context prepare and detector scripts', async () => {
        const onReady = jest.fn();
        (globalThis as typeof globalThis & { browser?: unknown }).browser = {
            runtime: {
                getURL: (path: string) => `moz-extension://local/${path}`
            }
        };
        window.addEventListener(
            '__react_devtools_prepare_loader_ready__',
            onReady
        );

        const loader = await import('../src/content/prepare-loader');

        expect(
            document.getElementById(loader.PREPARE_SCRIPT_ID)
        ).toHaveAttribute(
            'src',
            `moz-extension://local/${loader.PREPARE_SCRIPT_PATH}`
        );
        expect(
            document.getElementById(loader.DETECTOR_SCRIPT_ID)
        ).toHaveAttribute(
            'src',
            `moz-extension://local/${loader.DETECTOR_SCRIPT_PATH}`
        );
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    didInjectDetector: true,
                    didInjectPrepare: true,
                    source: 'react-devtools-extension'
                }
            })
        );
        expect(loader.injectFirefoxPageScripts()).toEqual({
            didInjectDetector: false,
            didInjectPrepare: false
        });
    });

    it('skips Firefox page-context injection when runtime URLs are unavailable', async () => {
        const loader = await import('../src/content/prepare-loader');

        expect(loader.injectFirefoxPageScripts()).toEqual({
            didInjectDetector: false,
            didInjectPrepare: false
        });
    });

    it('announces the isolated-world proxy script readiness', async () => {
        const onReady = jest.fn();
        const browser = createMockProxyBrowser();
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;
        window.addEventListener('__react_devtools_proxy_ready__', onReady);

        await import('../src/content/proxy');

        expect(browser.runtime.connect).toHaveBeenCalledWith({
            name: 'content-script'
        });
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    didOpenProxyRelay: true,
                    source: 'react-devtools-extension'
                }
            })
        );

        window.postMessage(
            {
                source: 'react-devtools-extension',
                type: 'react-devtools:react-detected'
            },
            '*'
        );
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
            source: 'react-devtools-extension',
            type: 'react-devtools:react-detected'
        });
    });

    it('keeps the Firefox proxy inert when extension runtime is unavailable', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_proxy_ready__', onReady);

        const proxy = await import('../src/content/proxy');

        expect(proxy.openExtensionProxyRelay()).toBe(false);
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    didOpenProxyRelay: false,
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('creates the Firefox DevTools panel when React is detected', async () => {
        const onReady = jest.fn();
        const browser = createMockDevToolsBrowser([false, true]);
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;
        jest.useFakeTimers();
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
        expect(browser.devtools.inspectedWindow.eval).toHaveBeenCalledTimes(1);

        jest.runOnlyPendingTimers();

        expect(browser.devtools.inspectedWindow.eval).toHaveBeenCalledTimes(2);
        expect(browser.devtools.panels.create).toHaveBeenCalledWith(
            'React',
            '',
            'devtools-panel.html'
        );
    });

    it('does not create a Firefox DevTools panel when APIs are missing or detection expires', async () => {
        (globalThis as typeof globalThis & { browser?: unknown }).browser = {};
        const devtools = await import('../src/devtools');

        expect(devtools.startDevToolsPanelDetection()).toBeUndefined();

        const browser = createMockDevToolsBrowser([false, false]);
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;
        jest.useFakeTimers();

        devtools.startDevToolsPanelDetection({
            maxAttempts: 2,
            setTimeout: globalThis.setTimeout
        });
        jest.runOnlyPendingTimers();

        expect(browser.devtools.panels.create).not.toHaveBeenCalled();
    });

    it('mounts the Firefox DevTools panel and injects the user app', async () => {
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
        const onReady = jest.fn();
        const browser = createMockPanelBrowser();
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;
        document.body.innerHTML = '<div id="root"></div>';
        globalThis.addEventListener('__react_devtools_panel_ready__', onReady);

        const panel = await import('../src/devtools-panel');

        expect(browser.tabs.executeScript).toHaveBeenCalledWith(7, {
            file: panel.PROXY_SCRIPT_PATH
        });
        expect(browser.devtools.inspectedWindow.eval).toHaveBeenCalledWith(
            expect.stringContaining('moz-extension://local/user-app.js')
        );
        expect(mountDevToolsClient).toHaveBeenCalledWith(
            document.getElementById('root')
        );
        expect(createDevToolsCoreClient).toHaveBeenCalledWith({
            preset: 'extension'
        });
        expect(
            panel.createUserAppInjectionExpression(
                'moz-extension://local/app.js'
            )
        ).toContain(panel.USER_APP_SCRIPT_ID);
        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    didInjectProxy: true,
                    didInjectUserApp: true,
                    didMountClient: true,
                    didOpenRpcClient: true,
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('reports missing Firefox DevTools panel APIs without mounting a root', async () => {
        const browser = createMockPanelBrowser();
        delete (browser.api as { tabs?: unknown }).tabs;
        delete (browser.api as { runtime?: unknown }).runtime;
        (globalThis as typeof globalThis & { browser?: unknown }).browser =
            browser.api;

        const panel = await import('../src/devtools-panel');

        expect(panel.bootstrapDevToolsPanel()).toEqual({
            didInjectProxy: false,
            didInjectUserApp: false,
            didMountClient: false,
            didOpenRpcClient: true
        });
    });
});

function createMockBackgroundBrowser() {
    const runtimeMessageListeners: Array<
        (message: unknown, sender?: unknown) => void
    > = [];
    const connectListeners: Array<(port: MockBackgroundPort) => void> = [];
    const tabRemovedListeners: Array<(tabId: number) => void> = [];
    const tabUpdatedListeners: Array<
        (tabId: number, changeInfo?: unknown) => void
    > = [];
    const browserAction = {
        setBadgeBackgroundColor: jest.fn(),
        setBadgeText: jest.fn(),
        setPopup: jest.fn(),
        setTitle: jest.fn()
    };

    return {
        api: {
            browserAction,
            runtime: {
                onConnect: {
                    addListener: (
                        listener: (port: MockBackgroundPort) => void
                    ) => connectListeners.push(listener)
                },
                onMessage: {
                    addListener: (
                        listener: (message: unknown, sender?: unknown) => void
                    ) => runtimeMessageListeners.push(listener)
                }
            },
            tabs: {
                onRemoved: {
                    addListener: (listener: (tabId: number) => void) =>
                        tabRemovedListeners.push(listener)
                },
                onUpdated: {
                    addListener: (
                        listener: (tabId: number, changeInfo?: unknown) => void
                    ) => tabUpdatedListeners.push(listener)
                }
            }
        },
        browserAction,
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
            for (const listener of tabRemovedListeners) {
                listener(tabId);
            }
        },
        updateTab(tabId: number, changeInfo?: unknown) {
            for (const listener of tabUpdatedListeners) {
                listener(tabId, changeInfo);
            }
        }
    };
}

interface MockBackgroundPort {
    disconnect: () => void;
    emitMessage: (message: unknown) => void;
    name: string;
    onDisconnect: {
        addListener: (handler: () => void) => void;
        removeListener: (handler: () => void) => void;
    };
    onMessage: {
        addListener: (handler: (message: unknown) => void) => void;
        removeListener: (handler: (message: unknown) => void) => void;
    };
    postMessage: (message: unknown) => void;
    sender?: unknown;
    sentMessages: unknown[];
}

function createMockBackgroundPort(
    name: string,
    tabId?: number
): MockBackgroundPort {
    const messageListeners = new Set<(message: unknown) => void>();
    const disconnectListeners = new Set<() => void>();
    const sentMessages: unknown[] = [];

    return {
        disconnect() {
            for (const listener of disconnectListeners) {
                listener();
            }
        },
        emitMessage(message: unknown) {
            for (const listener of messageListeners) {
                listener(message);
            }
        },
        name,
        onDisconnect: {
            addListener: (handler) => disconnectListeners.add(handler),
            removeListener: (handler) => disconnectListeners.delete(handler)
        },
        onMessage: {
            addListener: (handler) => messageListeners.add(handler),
            removeListener: (handler) => messageListeners.delete(handler)
        },
        postMessage(message) {
            sentMessages.push(message);
        },
        sender: tabId === undefined ? undefined : { tab: { id: tabId } },
        sentMessages
    };
}

function createMockProxyBrowser() {
    const port = createMockBackgroundPort('content-script');
    const runtime = {
        connect: jest.fn(() => port),
        sendMessage: jest.fn()
    };

    return {
        api: {
            runtime
        },
        runtime
    };
}

function createMockDevToolsBrowser(results: boolean[]) {
    const devtools = {
        inspectedWindow: {
            eval: jest.fn(
                (
                    _expression: string,
                    callback: (result: unknown, exceptionInfo?: unknown) => void
                ) => {
                    callback(results.shift() ?? false);
                }
            )
        },
        panels: {
            create: jest.fn()
        }
    };

    return {
        api: {
            devtools
        },
        devtools
    };
}

function createMockPanelBrowser() {
    const devtools = {
        inspectedWindow: {
            eval: jest.fn(),
            tabId: 7
        }
    };
    const runtime = {
        getURL: jest.fn((path: string) => `moz-extension://local/${path}`)
    };
    const tabs = {
        executeScript: jest.fn()
    };

    return {
        api: {
            devtools,
            runtime,
            tabs
        },
        devtools,
        runtime,
        tabs
    };
}
