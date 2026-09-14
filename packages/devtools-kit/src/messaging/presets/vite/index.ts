import type { RpcChannel, RpcHost } from '../../index.js';
import { createViteClientChannel } from './client.js';
import { createViteProxyChannel } from './proxy.js';
import { createViteServerChannel } from './server.js';

export * from './client.js';
export * from './context.js';
export * from './proxy.js';
export * from './server.js';

export function getViteRpcChannel(host: RpcHost): RpcChannel {
    if (host === 'server') {
        return createViteServerChannel();
    }

    if (host === 'proxy') {
        return createViteProxyChannel();
    }

    return createViteClientChannel();
}
