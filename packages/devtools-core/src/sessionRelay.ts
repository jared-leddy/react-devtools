import { createRpcServer, type RpcChannel } from '@devtools/kit';
import type { DevToolsSession } from './session.js';
import { DEVTOOLS_PROTOCOL_VERSION } from './session.js';
import type { DevToolsCoreClientFunctions } from './rpc.js';
import type { DevToolsCoreHandshakeRequest } from './types.js';

// A borrowed host session stays authoritative; the iframe receives snapshots only.
export function createDevToolsSessionRelay(
    session: DevToolsSession,
    channel: RpcChannel
) {
    const server = createRpcServer<
        DevToolsCoreClientFunctions,
        {
            handshake: (
                request: DevToolsCoreHandshakeRequest
            ) => Promise<import('./types.js').DevToolsCoreHandshakeResponse>;
        }
    >(
        {
            async handshake(request) {
                if (request.protocolVersion !== DEVTOOLS_PROTOCOL_VERSION)
                    throw new Error('Unsupported DevTools protocol version');
                await session.connect();
                const snapshot = session.getSnapshot();
                if (
                    snapshot.status !== 'connected' ||
                    !snapshot.state ||
                    !snapshot.capabilities ||
                    !snapshot.serverId
                )
                    throw new Error('Host session is not connected');
                return {
                    protocolVersion: DEVTOOLS_PROTOCOL_VERSION,
                    serverId: snapshot.serverId,
                    state: snapshot.state,
                    capabilities: {
                        ...snapshot.capabilities,
                        components: false,
                        componentState: false,
                        highlight: false,
                        inspect: false,
                        edit: false,
                        stores: false
                    }
                };
            }
        },
        { channel, options: { timeout: 5000 } }
    );
    const unsubscribe = session.subscribe(() => {
        const snapshot = session.getSnapshot();
        if (snapshot.status === 'connected' && snapshot.state)
            void server.broadcast
                .notifyStateUpdated(snapshot.state)
                .catch(() => {});
        else if (
            snapshot.status === 'disconnected' ||
            snapshot.status === 'error'
        )
            void server.broadcast
                .setTransportStatus('disconnected')
                .catch(() => {});
    });
    return {
        dispose() {
            unsubscribe();
            server.clients.forEach((client) => client.$close());
        }
    };
}
