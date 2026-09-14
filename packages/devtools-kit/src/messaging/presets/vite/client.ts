import type { RpcChannel } from '../../index.js';
import {
    createViteHotChannel,
    getViteClientContext,
    type CreateViteClientChannelOptions
} from './context.js';

export function createViteClientChannel(
    options: CreateViteClientChannelOptions = {}
): RpcChannel {
    return createViteHotChannel(
        options.hot ?? getViteClientContext(),
        options.eventKey
    );
}
