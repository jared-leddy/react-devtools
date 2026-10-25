import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';
import {
    EXTENSION_RPC_EVENT_KEY,
    EXTENSION_DISCONNECT_EVENT_KEY,
    EXTENSION_RPC_MESSAGE_SOURCE,
    getExtensionServerContext,
    getExtensionWindow,
    isExtensionRpcEnvelope,
    setExtensionServerContext,
    type CreateExtensionServerChannelOptions,
    type ExtensionWindowMessageListener
} from './context.js';

export function createExtensionServerChannel(
    options: CreateExtensionServerChannelOptions = {}
): RpcChannel {
    const window =
        getExtensionWindow(options.window) ?? getExtensionServerContext();

    if (!window) {
        return createNoopChannel();
    }

    setExtensionServerContext(window);

    const eventKey = options.eventKey ?? EXTENSION_RPC_EVENT_KEY;
    const targetOrigin = options.targetOrigin ?? '*';
    const listeners = new Map<
        (data: unknown) => void,
        ExtensionWindowMessageListener
    >();

    return {
        subscribeDisconnect(handler) {
            const listener: ExtensionWindowMessageListener = (event) => {
                if (
                    event.source === window &&
                    event.data &&
                    typeof event.data === 'object' &&
                    (event.data as { event?: unknown }).event ===
                        EXTENSION_DISCONNECT_EVENT_KEY
                )
                    handler();
            };
            window.addEventListener('message', listener);
            return () => window.removeEventListener?.('message', listener);
        },
        off(handler) {
            const listener = listeners.get(handler);

            if (!listener) {
                return;
            }

            listeners.delete(handler);
            window.removeEventListener?.('message', listener);
        },
        on(handler) {
            const listener: ExtensionWindowMessageListener = (event) => {
                if (
                    event.source !== window ||
                    !isExtensionRpcEnvelope(
                        event.data,
                        EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER,
                        eventKey
                    )
                ) {
                    return;
                }

                handler(event.data.payload);
            };

            listeners.set(handler, listener);
            window.addEventListener('message', listener);
        },
        post(data) {
            window.postMessage(
                {
                    event: eventKey,
                    payload: data,
                    source: EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY
                },
                targetOrigin
            );
        }
    };
}
