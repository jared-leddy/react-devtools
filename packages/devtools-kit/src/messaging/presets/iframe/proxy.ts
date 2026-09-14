import type { RpcChannel } from '../../index.js';
import { createIframeClientChannel } from './client.js';
import type { CreateIframeChannelOptions } from './context.js';

export function createIframeProxyChannel(
    options: CreateIframeChannelOptions = {}
): RpcChannel {
    return createIframeClientChannel(options);
}
