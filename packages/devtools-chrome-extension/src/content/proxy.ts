import { createExtensionProxyChannel, type ChromeLike } from '@devtools/kit';

interface ChromeRuntimeLike {
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

const didOpenProxyRelay = openExtensionProxyRelay();

const forwardReactDetectedMessage = (event: MessageEvent) => {
    if (!isReactDetectedMessage(event.data)) {
        return;
    }

    getChromeRuntime()?.sendMessage?.(createReactDetectedRuntimeMessage());
};

window.addEventListener('message', forwardReactDetectedMessage);

window.dispatchEvent(
    new CustomEvent('__react_devtools_proxy_ready__', {
        detail: {
            didOpenProxyRelay,
            source: 'react-devtools-extension'
        }
    })
);

export function openExtensionProxyRelay(): boolean {
    const chrome = getChromeApi();

    if (!chrome?.runtime?.connect) {
        return false;
    }

    createExtensionProxyChannel({ chrome: chrome as ChromeLike, window });

    return true;
}

function createReactDetectedRuntimeMessage(): ReactDetectedRuntimeMessage {
    return {
        source: REACT_DETECTED_MESSAGE_SOURCE,
        type: REACT_DETECTED_MESSAGE_TYPE
    };
}

function getChromeRuntime() {
    return getChromeApi()?.runtime;
}

function getChromeApi() {
    return (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike })
        .chrome;
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
