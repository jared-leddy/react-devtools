import type { RpcChannel, RpcHost } from '../../index.js';
import { createExtensionClientChannel } from './client.js';
import { createExtensionProxyChannel } from './proxy.js';
import { createExtensionServerChannel } from './server.js';

export * from './client.js';
export * from './context.js';
export * from './proxy.js';
export * from './server.js';

export function getExtensionRpcChannel(host: RpcHost): RpcChannel {
    if (host === 'server') {
        return createExtensionServerChannel();
    }

    if (host === 'proxy') {
        return createExtensionProxyChannel();
    }

    return createExtensionClientChannel();
}
