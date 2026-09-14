import type { RpcChannel } from '../../index.js';
import {
    createViteHotChannel,
    getViteServerContext,
    getViteServerWebSocket,
    type CreateViteServerChannelOptions
} from './context.js';

export function createViteServerChannel(
    options: CreateViteServerChannelOptions = {}
): RpcChannel {
    return createViteHotChannel(
        getViteServerWebSocket(options.server ?? getViteServerContext()),
        options.eventKey
    );
}
