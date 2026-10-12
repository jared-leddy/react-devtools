import {
    createContext,
    useContext,
    useSyncExternalStore,
    type ReactNode
} from 'react';
import type {
    DevToolsSession,
    DevToolsSessionSnapshot
} from '@devtools/core/browser';
import type { ClientRuntimeSnapshot } from './runtime';

const SessionContext = createContext<DevToolsSessionSnapshot | undefined>(
    undefined
);
const absentSnapshot: DevToolsSessionSnapshot = {
    sessionId: 'unavailable',
    status: 'waiting'
};
const emptySubscribe = () => () => {};
const getAbsentSnapshot = () => absentSnapshot;

export function DevToolsSessionProvider({
    session,
    children
}: {
    session?: DevToolsSession;
    children: ReactNode;
}) {
    const snapshot = useSyncExternalStore(
        session?.subscribe ?? emptySubscribe,
        session?.getSnapshot ?? getAbsentSnapshot,
        session?.getSnapshot ?? getAbsentSnapshot
    );
    return (
        <SessionContext.Provider value={session ? snapshot : undefined}>
            {children}
        </SessionContext.Provider>
    );
}

export function useDevToolsSessionSnapshot():
    DevToolsSessionSnapshot | undefined {
    return useContext(SessionContext);
}

export function getSessionRuntimeSnapshot(
    snapshot: DevToolsSessionSnapshot
): ClientRuntimeSnapshot {
    return {
        connectionStatus:
            snapshot.status === 'connected'
                ? 'connected'
                : snapshot.status === 'connecting' ||
                    snapshot.status === 'waiting'
                  ? 'waiting'
                  : 'disconnected',
        reactStatus: snapshot.state?.renderers.length
            ? 'detected'
            : 'not-detected',
        rootStatus: snapshot.state?.roots.length ? 'ready' : 'empty',
        selectionStatus: snapshot.state?.selectedComponentId
            ? 'selected'
            : 'none'
    };
}
