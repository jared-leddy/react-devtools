import type { RpcChannel, RpcHost } from '../../index.js';
import { createBroadcastChannelClientChannel } from './client.js';
import { createBroadcastChannelProxyChannel } from './proxy.js';
import { createBroadcastChannelServerChannel } from './server.js';

export * from './client.js';
export * from './context.js';
export * from './proxy.js';
export * from './server.js';

export function getBroadcastChannelRpcChannel(host: RpcHost): RpcChannel {
    if (host === 'server') {
        return createBroadcastChannelServerChannel();
    }

    if (host === 'proxy') {
        return createBroadcastChannelProxyChannel();
    }

    return createBroadcastChannelClientChannel();
}
