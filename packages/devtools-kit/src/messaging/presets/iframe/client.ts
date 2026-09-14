import type { RpcChannel } from '../../index.js';
import {
    IFRAME_RPC_EVENT_KEY,
    createNoopChannel,
    getAllowedOrigin,
    getCurrentWindow,
    getTargetOrigin,
    isAllowedOrigin,
    isIframeRpcEnvelope,
    type CreateIframeChannelOptions,
    type IframeRpcEnvelope,
    type WindowMessageListener
} from './context.js';

export function createIframeClientChannel(
    options: CreateIframeChannelOptions = {}
): RpcChannel {
    const window = options.window ?? getCurrentWindow();

    if (!window?.parent) {
        return createNoopChannel();
    }

    const eventKey = options.eventKey ?? IFRAME_RPC_EVENT_KEY;
    const allowedOrigin = getAllowedOrigin(window, options.allowedOrigin);
    const targetOrigin = getTargetOrigin(
        window,
        options.targetOrigin,
        options.allowedOrigin
    );
    const parentWindow = window.parent;
    const messageListeners = new Map<
        (data: unknown) => void,
        WindowMessageListener
    >();

    const postEnvelope = (envelope: IframeRpcEnvelope) => {
        parentWindow.postMessage(envelope, targetOrigin);
    };

    return {
        off(handler) {
            const listener = messageListeners.get(handler);

            if (!listener) {
                return;
            }

            messageListeners.delete(handler);
            window.removeEventListener?.('message', listener);
        },
        on(handler) {
            const listener: WindowMessageListener = (event) => {
                if (
                    event.source !== parentWindow ||
                    !isAllowedOrigin(event.origin, allowedOrigin) ||
                    !isIframeRpcEnvelope(event.data, eventKey) ||
                    event.data.kind !== 'message'
                ) {
                    return;
                }

                handler(event.data.data);
            };

            messageListeners.set(handler, listener);
            window.addEventListener('message', listener);
            postEnvelope({ event: eventKey, kind: 'ready' });
        },
        post(data) {
            postEnvelope({ data, event: eventKey, kind: 'message' });
        }
    };
}
