export type ClientConnectionStatus =
    'connected' | 'disconnected' | 'reconnecting' | 'waiting';
export type ClientReactStatus = 'detected' | 'not-detected' | 'unsupported';
export type ClientRootStatus = 'empty' | 'ready';
export type ClientSelectionStatus = 'none' | 'selected';

export interface ClientRuntimeSnapshot {
    connectionStatus: ClientConnectionStatus;
    reactStatus: ClientReactStatus;
    rootStatus: ClientRootStatus;
    selectionStatus: ClientSelectionStatus;
    unsupportedReactVersion?: string;
}

type RuntimeListener = () => void;

const defaultRuntimeSnapshot: ClientRuntimeSnapshot = {
    connectionStatus: 'connected',
    reactStatus: 'detected',
    rootStatus: 'ready',
    selectionStatus: 'selected'
};
const runtimeListeners = new Set<RuntimeListener>();
let currentRuntimeSnapshot = defaultRuntimeSnapshot;

export function subscribeToClientRuntime(
    listener: RuntimeListener
): () => void {
    runtimeListeners.add(listener);

    return () => {
        runtimeListeners.delete(listener);
    };
}

export function getClientRuntimeSnapshot(): ClientRuntimeSnapshot {
    return currentRuntimeSnapshot;
}

export function setClientRuntimeState(
    snapshot: Partial<ClientRuntimeSnapshot>
): void {
    currentRuntimeSnapshot = {
        ...currentRuntimeSnapshot,
        ...snapshot
    };
    runtimeListeners.forEach((listener) => listener());
}

export function resetClientRuntimeForTests(): void {
    runtimeListeners.clear();
    currentRuntimeSnapshot = defaultRuntimeSnapshot;
}
