import { createRpcServer, type RpcChannel } from '@devtools/kit';
import type { DevToolsSession } from './session.js';
import { DEVTOOLS_PROTOCOL_VERSION } from './protocol.js';
import {
    createInitialDevToolsCoreState,
    type DevToolsCoreStateListener
} from './state.js';
import type { DevToolsCoreClientFunctions } from './rpc.js';
import type { DevToolsCoreHandshakeRequest } from './types.js';
import type { ComponentStateRequest } from './types.js';
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
    const functions = {
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
                    highlight: false,
                    inspect: false,
                    edit: false,
                    stores: false
                }
            };
        },
        getComponentState: (request: ComponentStateRequest) =>
            session.inspectComponent?.(request),
        getSessionSnapshot: updates.getSnapshot,
        getSessionRevision: updates.getRevision,
        disconnectSession: updates.disconnect
    };
    const server = createRpcServer<
        DevToolsCoreClientFunctions,
        typeof functions
    >(functions, {
        channel,
        options: { timeout: 5000 },
        onDisconnect: () => updates.suspend()
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
        dispose() {
            unsubscribe();
            updates.dispose();
            server.dispose();
        }
    };
}
