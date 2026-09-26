type ReactDetectedMessageSource = 'react-devtools-extension';
type ReactDetectedMessageType = 'react-devtools:react-detected';

interface ReactDetectedMessage {
    source: ReactDetectedMessageSource;
    type: ReactDetectedMessageType;
}

interface ReactDevToolsDetectorHook {
    on?: (event: string, listener: () => void) => void;
    off?: (event: string, listener: () => void) => void;
    rendererInterfaces?: unknown;
    renderers?: unknown;
    supportsFiber?: unknown;
}

interface ReactDevToolsDetectorWindow extends Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
}

const REACT_DETECTED_MESSAGE_SOURCE = 'react-devtools-extension';
const REACT_DETECTED_MESSAGE_TYPE = 'react-devtools:react-detected';
const REACT_DETECTED_READY_EVENT = '__react_devtools_detector_ready__';
const REACT_DEVTOOLS_GLOBAL_HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';

const stopReactDetection = startReactDetection(window);

window.dispatchEvent(
    new CustomEvent(REACT_DETECTED_READY_EVENT, {
        detail: {
            source: REACT_DETECTED_MESSAGE_SOURCE
        }
    })
);

export function hasDetectedReact(hook: unknown): boolean {
    return (
        isReactDevToolsHook(hook) &&
        (hasRegisteredRenderer(hook.renderers) ||
            hasRegisteredRenderer(hook.rendererInterfaces))
    );
}

function startReactDetection(target: ReactDevToolsDetectorWindow) {
    let didSignalReactDetected = false;

    const signalReactDetected = () => {
        if (didSignalReactDetected) {
            return;
        }

        if (!hasDetectedReact(target[REACT_DEVTOOLS_GLOBAL_HOOK_KEY])) {
            return;
        }

        didSignalReactDetected = true;
        target.postMessage(createReactDetectedMessage(), '*');
    };

    signalReactDetected();

    const hook = target[REACT_DEVTOOLS_GLOBAL_HOOK_KEY];

    if (!isReactDevToolsHook(hook) || typeof hook.on !== 'function') {
        return () => undefined;
    }

    hook.on('renderer', signalReactDetected);
    hook.on('renderer-attached', signalReactDetected);

    return () => {
        hook.off?.('renderer', signalReactDetected);
        hook.off?.('renderer-attached', signalReactDetected);
    };
}

function createReactDetectedMessage(): ReactDetectedMessage {
    return {
        source: REACT_DETECTED_MESSAGE_SOURCE,
        type: REACT_DETECTED_MESSAGE_TYPE
    };
}

function hasRegisteredRenderer(registry: unknown): boolean {
    if (registry instanceof Map || registry instanceof Set) {
        return registry.size > 0;
    }

    if (Array.isArray(registry)) {
        return registry.length > 0;
    }

    return isRecord(registry) && Object.keys(registry).length > 0;
}

function isReactDevToolsHook(
    value: unknown
): value is ReactDevToolsDetectorHook {
    return isRecord(value) && value.supportsFiber === true;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

export { stopReactDetection };
