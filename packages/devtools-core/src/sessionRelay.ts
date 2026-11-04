import { createRpcServer, type RpcChannel } from '@devtools/kit';
import type { DevToolsSession } from './session.js';
import { DEVTOOLS_PROTOCOL_VERSION } from './protocol.js';
import {
    createInitialDevToolsCoreState,
    type DevToolsCoreStateListener
} from './state.js';
import type { DevToolsCoreClientFunctions } from './rpc.js';
import type { DevToolsCoreHandshakeRequest } from './types.js';
import type { ComponentStateRequest, HighlightRequest } from './types.js';
import { createDevToolsUpdatePublisher } from './updates.js';

// A borrowed session remains authoritative; the relay exposes metadata, not inspectors.
export function createDevToolsSessionRelay(
    session: DevToolsSession,
    channel: RpcChannel
) {
    let state = createInitialDevToolsCoreState();
    const listeners = new Set<DevToolsCoreStateListener>();
    const updates = createDevToolsUpdatePublisher({
        store: {
            getState: () => state,
            subscribe(listener) {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            }
        },
        publish: (update) => server.broadcast.notifySessionUpdated(update)
    });
    const synchronize = () => {
        const source = session.getSnapshot();
        const patch =
            source.status === 'connected' && source.state
                ? {
                      inspectMode: source.state.inspectMode,
                      selectedComponentId: source.state.selectedComponentId,
                      selectedRootId: source.state.selectedRootId,
                      highlightedComponentId:
                          source.state.highlightedComponentId,
                      renderers: source.state.renderers,
                      roots: source.state.roots,
                      components: source.state.components,
                      rootEvents: source.state.rootEvents,
                      performance: source.state.performance,
                      transportStatus: source.state.transportStatus
                  }
                : { transportStatus: 'disconnected' as const };
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener(state, patch));
    };
    let disposed = false;
    let picking = false;
    let highlighting = false;
    const stopPicking = () => {
        if (picking) void session.setInspectMode?.(false).catch(() => {});
        picking = false;
        if (highlighting) void session.clearHighlight?.().catch(() => {});
        highlighting = false;
    };
    const functions = {
        async highlightComponent(request: HighlightRequest) {
            if (!session.highlightComponent)
                throw new Error('Highlight unavailable');
            highlighting = true;
            await session.highlightComponent(request);
            return state;
        },
        async clearHighlight() {
            highlighting = false;
            await session.clearHighlight?.();
            return state;
        },
        async scrollToComponent(request: HighlightRequest) {
            return session.scrollToComponent?.(request) ?? false;
        },
        async setInspectMode(enabled: boolean) {
            if (!session.setInspectMode) throw new Error('Picker unavailable');
            picking = enabled;
            try {
                await session.setInspectMode(enabled);
            } catch (error) {
                picking = false;
                throw error;
            }
            return state;
        },
        async handshake(request: DevToolsCoreHandshakeRequest) {
            if (request.protocolVersion !== DEVTOOLS_PROTOCOL_VERSION)
                throw new Error('Unsupported DevTools protocol version');
            await session.connect();
            const source = session.getSnapshot();
            if (
                source.status !== 'connected' ||
                !source.state ||
                !source.capabilities ||
                !source.serverId
            )
                throw new Error('Host session is not connected');
            synchronize();
            return {
                ...updates.connect(request.sessionId ?? request.clientId),
                protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
                serverId: source.serverId,
                capabilities: {
                    ...source.capabilities,
                    components: source.capabilities.components,
                    componentState:
                        source.capabilities.componentState &&
                        !!session.inspectComponent,
                    highlight:
                        source.capabilities.highlight &&
                        !!session.highlightComponent &&
                        !!session.clearHighlight &&
                        !!session.scrollToComponent,
                    inspect:
                        source.capabilities.inspect && !!session.setInspectMode,
                    edit: false,
                    stores: false
                }
            };
        },
        getComponentState: (request: ComponentStateRequest) =>
            session.inspectComponent?.(request),
        getSessionSnapshot: updates.getSnapshot,
        getSessionRevision: updates.getRevision,
        disconnectSession(request: Parameters<typeof updates.disconnect>[0]) {
            stopPicking();
            return updates.disconnect(request);
        }
    };
    const server = createRpcServer<
        DevToolsCoreClientFunctions,
        typeof functions
    >(functions, {
        channel,
        options: { timeout: 5000 },
        onDisconnect: () => {
            stopPicking();
            updates.suspend();
        }
    });
    const unsubscribe = session.subscribe(() => {
        const source = session.getSnapshot();
        if (source.status === 'connected') synchronize();
        else if (
            source.status === 'disconnected' ||
            source.status === 'error'
        ) {
            synchronize();
            updates.flush();
            updates.suspend();
        }
    });
    return {
        async setInspectMode(enabled: boolean) {
            if (disposed) throw new Error('Relay disconnected');
            await session.connect();
            if (disposed) throw new Error('Relay disconnected');
            return functions.setInspectMode(enabled);
        },
        subscribeInspectMode: (listener: (enabled: boolean) => void) =>
            session.subscribe(() =>
                listener(
                    session.getSnapshot().state?.inspectMode.enabled ?? false
                )
            ),
        dispose() {
            disposed = true;
            stopPicking();
            unsubscribe();
            updates.dispose();
            server.dispose();
        }
    };
}
