interface ChromeRuntimeLike {
    runtime?: {
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
            source: 'react-devtools-extension'
        }
    })
);

function createReactDetectedRuntimeMessage(): ReactDetectedRuntimeMessage {
    return {
        source: REACT_DETECTED_MESSAGE_SOURCE,
        type: REACT_DETECTED_MESSAGE_TYPE
    };
}

function getChromeRuntime() {
    return (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike })
        .chrome?.runtime;
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
