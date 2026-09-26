interface ChromeRuntimeLike {
    action?: {
        setBadgeBackgroundColor?: (details: {
            color: string;
            tabId?: number;
        }) => void;
        setBadgeText?: (details: { tabId?: number; text: string }) => void;
        setPopup?: (details: { popup: string; tabId?: number }) => void;
        setTitle?: (details: { tabId?: number; title: string }) => void;
    };
    runtime?: {
        onConnect?: {
            addListener?: (listener: (port: ExtensionPortLike) => void) => void;
        };
        onMessage?: {
            addListener?: (
                listener: (message: unknown, sender?: unknown) => void
            ) => void;
        };
    };
    tabs?: {
        onRemoved?: {
            addListener?: (listener: (tabId: number) => void) => void;
        };
        onUpdated?: {
            addListener?: (
                listener: (tabId: number, changeInfo?: unknown) => void
            ) => void;
        };
    };
}

interface ExtensionEventTargetLike<Handler extends (...args: never[]) => void> {
    addListener: (handler: Handler) => void;
    removeListener?: (handler: Handler) => void;
}

interface ExtensionPortLike {
    name?: string;
    onDisconnect: ExtensionEventTargetLike<() => void>;
    onMessage: ExtensionEventTargetLike<(message: unknown) => void>;
    postMessage: (message: unknown) => void;
    sender?: unknown;
}

interface ReactDetectedRuntimeMessage {
    source?: unknown;
    type?: unknown;
}

interface TabPorts {
    devtoolsPort?: ExtensionPortLike;
    pagePort?: ExtensionPortLike;
}

const REACT_DETECTED_MESSAGE_SOURCE = 'react-devtools-extension';
const REACT_DETECTED_MESSAGE_TYPE = 'react-devtools:react-detected';
const CONTENT_SCRIPT_PORT_NAME = 'content-script';
const DETECTED_BADGE_COLOR = '#149eca';
const DETECTED_BADGE_TEXT = 'R';
const POPUP_PATH = 'popup.html';
const REACT_DETECTED_TITLE = 'React DevTools - React detected';
const REACT_NOT_DETECTED_TITLE = 'React DevTools';
const detectedReactTabs = new Set<number>();
const portsByTab = new Map<number, TabPorts>();

self.addEventListener('install', () => undefined);
self.addEventListener('activate', () => undefined);

const chromeApi = getChromeApi();

chromeApi?.runtime?.onMessage?.addListener?.((message, sender) => {
    if (!isReactDetectedRuntimeMessage(message)) {
        return;
    }

    const tabId = getSenderTabId(sender);

    if (tabId !== undefined) {
        markReactDetected(tabId);
    }
});

chromeApi?.runtime?.onConnect?.addListener?.((port) => {
    const tabId = getPortTabId(port);

    if (tabId === undefined) {
        return;
    }

    const tabPorts = getTabPorts(tabId);

    if (port.name === CONTENT_SCRIPT_PORT_NAME) {
        tabPorts.pagePort = port;
    } else {
        tabPorts.devtoolsPort = port;
    }

    attachPortRelay(tabId, port);
});

chromeApi?.tabs?.onRemoved?.addListener?.((tabId) => {
    clearTabState(tabId);
});

chromeApi?.tabs?.onUpdated?.addListener?.((tabId, changeInfo) => {
    if (isRecord(changeInfo) && changeInfo.status === 'loading') {
        clearTabState(tabId);
    }
});

function getChromeApi() {
    return (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike })
        .chrome;
}

function markReactDetected(tabId: number) {
    detectedReactTabs.add(tabId);
    setToolbarState(tabId, true);
}

function clearTabState(tabId: number) {
    detectedReactTabs.delete(tabId);
    portsByTab.delete(tabId);
    setToolbarState(tabId, false);
}

function setToolbarState(tabId: number, hasReact: boolean) {
    const action = getChromeApi()?.action;

    action?.setPopup?.({ popup: hasReact ? POPUP_PATH : '', tabId });
    action?.setTitle?.({
        tabId,
        title: hasReact ? REACT_DETECTED_TITLE : REACT_NOT_DETECTED_TITLE
    });
    action?.setBadgeText?.({
        tabId,
        text: hasReact ? DETECTED_BADGE_TEXT : ''
    });

    if (hasReact) {
        action?.setBadgeBackgroundColor?.({
            color: DETECTED_BADGE_COLOR,
            tabId
        });
    }
}

function getTabPorts(tabId: number): TabPorts {
    let tabPorts = portsByTab.get(tabId);

    if (!tabPorts) {
        tabPorts = {};
        portsByTab.set(tabId, tabPorts);
    }

    return tabPorts;
}

function attachPortRelay(tabId: number, port: ExtensionPortLike) {
    const relayMessage = (message: unknown) => {
        const counterpart = getCounterpartPort(tabId, port);

        try {
            counterpart?.postMessage(message);
        } catch {
            // Ports can disconnect between lookup and delivery during reloads.
        }
    };
    const disconnect = () => {
        const tabPorts = portsByTab.get(tabId);

        if (!tabPorts) {
            return;
        }

        if (tabPorts.devtoolsPort === port) {
            delete tabPorts.devtoolsPort;
        }

        if (tabPorts.pagePort === port) {
            delete tabPorts.pagePort;
        }

        port.onMessage.removeListener?.(relayMessage);

        if (!tabPorts.devtoolsPort && !tabPorts.pagePort) {
            portsByTab.delete(tabId);
        }
    };

    port.onMessage.addListener(relayMessage);
    port.onDisconnect.addListener(disconnect);
}

function getCounterpartPort(
    tabId: number,
    port: ExtensionPortLike
): ExtensionPortLike | undefined {
    const tabPorts = portsByTab.get(tabId);

    if (!tabPorts) {
        return undefined;
    }

    return tabPorts.devtoolsPort === port
        ? tabPorts.pagePort
        : tabPorts.devtoolsPort;
}

function getPortTabId(port: ExtensionPortLike): number | undefined {
    if (port.name === CONTENT_SCRIPT_PORT_NAME) {
        return getSenderTabId(port.sender);
    }

    const tabId = Number(port.name);

    return Number.isInteger(tabId) && tabId >= 0 ? tabId : undefined;
}

function getSenderTabId(sender: unknown): number | undefined {
    if (!isRecord(sender)) {
        return undefined;
    }

    const tab = sender.tab;

    if (!isRecord(tab) || typeof tab.id !== 'number') {
        return undefined;
    }

    return tab.id;
}

function isReactDetectedRuntimeMessage(
    value: unknown
): value is ReactDetectedRuntimeMessage {
    return (
        isRecord(value) &&
        value.source === REACT_DETECTED_MESSAGE_SOURCE &&
        value.type === REACT_DETECTED_MESSAGE_TYPE
    );
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

export function hasDetectedReactInTab(tabId: number): boolean {
    return detectedReactTabs.has(tabId);
}

export function hasPortsForTab(tabId: number): boolean {
    return portsByTab.has(tabId);
}

export {};
