import type { RpcChannel } from '../../index.js';
import {
    IFRAME_RPC_EVENT_KEY,
    createNoopChannel,
    getAllowedOrigin,
    getCurrentWindow,
    getTargetOrigin,
    isAllowedOrigin,
    isIframeRpcEnvelope,
    type CreateIframeServerChannelOptions,
    type WindowMessageListener
} from './context.js';

export function createIframeServerChannel(
    options: CreateIframeServerChannelOptions = {}
): RpcChannel {
    const window = options.window ?? getCurrentWindow();
    const iframeWindow = options.iframe?.contentWindow;

    if (!window || !iframeWindow) {
        return createNoopChannel();
    }

    const eventKey = options.eventKey ?? IFRAME_RPC_EVENT_KEY;
    const allowedOrigin = getAllowedOrigin(
        iframeWindow,
        options.allowedOrigin ?? window.location?.origin
    );
    const targetOrigin = getTargetOrigin(
        window,
        options.targetOrigin,
        options.allowedOrigin
    );
    const pendingMessages: unknown[] = [];
    const messageListeners = new Map<
        (data: unknown) => void,
        WindowMessageListener
    >();
    let isReady = false;

    const flushPendingMessages = () => {
        while (isReady && pendingMessages.length > 0) {
            iframeWindow.postMessage(pendingMessages.shift(), targetOrigin);
        }
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
                    event.source !== iframeWindow ||
                    !isAllowedOrigin(event.origin, allowedOrigin) ||
                    !isIframeRpcEnvelope(event.data, eventKey)
                ) {
                    return;
                }

                if (event.data.kind === 'ready') {
                    isReady = true;
                    flushPendingMessages();

                    return;
                }

                handler(event.data.data);
            };

            messageListeners.set(handler, listener);
            window.addEventListener('message', listener);
        },
        post(data) {
            const envelope = {
                data,
                event: eventKey,
                kind: 'message' as const
            };

            if (!isReady) {
                pendingMessages.push(envelope);
                return;
            }

            iframeWindow.postMessage(envelope, targetOrigin);
        }
    };
}
