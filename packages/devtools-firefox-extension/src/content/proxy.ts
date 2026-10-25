import {
    createExtensionProxyChannel,
    type ChromeLike,
    type RpcChannel
} from '@devtools/kit';

interface FirefoxRuntimeLike {
    runtime?: {
        connect?: (options?: { name?: string }) => {
            onDisconnect: {
                addListener: (handler: () => void) => void;
                removeListener?: (handler: () => void) => void;
            };
            onMessage: {
                addListener: (handler: (message: unknown) => void) => void;
                removeListener?: (handler: (message: unknown) => void) => void;
            };
            postMessage: (message: unknown) => void;
        };
        sendMessage?: (message: unknown) => void;
    };
}

interface ReactDetectedMessage {
    source?: unknown;
    type?: unknown;
}

interface ReactDetectedRuntimeMessage {
    source: 'react-devtools-extension';
    type: 'react-devtools:react-detected';
}

const REACT_DETECTED_MESSAGE_SOURCE = 'react-devtools-extension';
const REACT_DETECTED_MESSAGE_TYPE = 'react-devtools:react-detected';

const proxyOwner = window as Window & { __reactDevtoolsProxy?: RpcChannel };
const hadProxy = Boolean(proxyOwner.__reactDevtoolsProxy);
const didOpenProxyRelay = openExtensionProxyRelay();

const forwardReactDetectedMessage = (event: MessageEvent) => {
    if (
        event.source !== window ||
        window.top !== window ||
        !isReactDetectedMessage(event.data)
    ) {
        return;
    }

    getFirefoxRuntime()?.sendMessage?.(createReactDetectedRuntimeMessage());
};

if (!hadProxy) {
    window.addEventListener('message', forwardReactDetectedMessage);
    window.addEventListener('pagehide', () => {
        proxyOwner.__reactDevtoolsProxy?.dispose?.();
        delete proxyOwner.__reactDevtoolsProxy;
        window.removeEventListener('message', forwardReactDetectedMessage);
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.addEventListener('message', forwardReactDetectedMessage);
            openExtensionProxyRelay();
        }
    });
}

window.dispatchEvent(
    new CustomEvent('__react_devtools_proxy_ready__', {
        detail: {
            didOpenProxyRelay,
            source: 'react-devtools-extension'
        }
    })
);

export function openExtensionProxyRelay(): boolean {
    if (window.top !== window) return false;
    if (proxyOwner.__reactDevtoolsProxy) return true;
    const extensionApi = getFirefoxApi();

    if (!extensionApi?.runtime?.connect) {
        return false;
    }

    proxyOwner.__reactDevtoolsProxy = createExtensionProxyChannel({
        chrome: extensionApi as ChromeLike,
        window
    });

    return true;
}

function createReactDetectedRuntimeMessage(): ReactDetectedRuntimeMessage {
    return {
        source: REACT_DETECTED_MESSAGE_SOURCE,
        type: REACT_DETECTED_MESSAGE_TYPE
    };
}

function getFirefoxRuntime() {
    return getFirefoxApi()?.runtime;
}

function getFirefoxApi() {
    const target = globalThis as typeof globalThis & {
        browser?: FirefoxRuntimeLike;
        chrome?: FirefoxRuntimeLike;
    };

    return target.browser ?? target.chrome;
}

function isReactDetectedMessage(value: unknown): value is ReactDetectedMessage {
    return (
        isRecord(value) &&
        value.source === REACT_DETECTED_MESSAGE_SOURCE &&
        value.type === REACT_DETECTED_MESSAGE_TYPE
    );
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

export {};
