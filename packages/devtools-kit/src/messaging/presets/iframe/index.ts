import type { RpcChannel, RpcHost } from '../../index.js';
import { createIframeClientChannel } from './client.js';
import { createIframeProxyChannel } from './proxy.js';
import { createIframeServerChannel } from './server.js';

export * from './client.js';
export * from './context.js';
export * from './proxy.js';
export * from './server.js';

export function getIframeRpcChannel(host: RpcHost): RpcChannel {
    if (host === 'server') {
        return createIframeServerChannel();
    }

    if (host === 'proxy') {
        return createIframeProxyChannel();
    }

    return createIframeClientChannel();
}
