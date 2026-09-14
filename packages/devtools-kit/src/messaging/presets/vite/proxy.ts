import type { RpcChannel } from '../../index.js';
import { createViteServerChannel } from './server.js';
import type { CreateViteServerChannelOptions } from './context.js';

export function createViteProxyChannel(
    options: CreateViteServerChannelOptions = {}
): RpcChannel {
    return createViteServerChannel(options);
}
