import type { RpcChannel } from '../../index.js';
import {
    createBroadcastChannelRpcChannel,
    type CreateBroadcastChannelOptions
} from './context.js';

export function createBroadcastChannelServerChannel(
    options: CreateBroadcastChannelOptions = {}
): RpcChannel {
    return createBroadcastChannelRpcChannel(options);
}
