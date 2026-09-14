import type { RpcChannel } from '../../index.js';
import {
    createBroadcastChannelRpcChannel,
    type CreateBroadcastChannelOptions
} from './context.js';

export function createBroadcastChannelProxyChannel(
    options: CreateBroadcastChannelOptions = {}
): RpcChannel {
    return createBroadcastChannelRpcChannel(options);
}
