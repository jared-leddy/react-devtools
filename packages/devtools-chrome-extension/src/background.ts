interface ChromeRuntimeLike {
    runtime?: {
        onMessage?: {
            addListener?: (
                listener: (message: unknown, sender?: unknown) => void
            ) => void;
        };
    };
}

interface ReactDetectedRuntimeMessage {
    source?: unknown;
    type?: unknown;
}

const REACT_DETECTED_MESSAGE_SOURCE = 'react-devtools-extension';
const REACT_DETECTED_MESSAGE_TYPE = 'react-devtools:react-detected';
const detectedReactTabs = new Set<number>();

self.addEventListener('install', () => undefined);
self.addEventListener('activate', () => undefined);

getChromeRuntime()?.onMessage?.addListener?.((message, sender) => {
    if (!isReactDetectedRuntimeMessage(message)) {
        return;
    }

    const tabId = getSenderTabId(sender);

    if (tabId !== undefined) {
        detectedReactTabs.add(tabId);
    }
});

function getChromeRuntime() {
    return (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike })
        .chrome?.runtime;
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

export {};
