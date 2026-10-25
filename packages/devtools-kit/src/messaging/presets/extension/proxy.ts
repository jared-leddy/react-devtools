import type { RpcChannel } from '../../index.js';
import { createExtensionClientChannel } from './client.js';
import { createNoopChannel } from '../iframe/context.js';
import {
    EXTENSION_RPC_EVENT_KEY,
    EXTENSION_DISCONNECT_EVENT_KEY,
    EXTENSION_RPC_MESSAGE_SOURCE,
    getChromeRuntime,
    getExtensionWindow,
    isExtensionRpcEnvelope,
    setExtensionProxyContext,
    type CreateExtensionProxyChannelOptions,
    type ExtensionMessageHandler,
    type ExtensionWindowMessageListener
} from './context.js';

export function createExtensionProxyChannel(
    options: CreateExtensionProxyChannelOptions = {}
): RpcChannel {
    const chrome = getChromeRuntime(options.chrome);
    const window = getExtensionWindow(options.window);

    if (!chrome?.runtime || !window) {
        return createNoopChannel();
    }

    const eventKey = options.eventKey ?? EXTENSION_RPC_EVENT_KEY;
    const targetOrigin = options.targetOrigin ?? '*';
    const channel = createExtensionClientChannel({
        chrome,
        portName: options.portName ?? 'content-script',
        setContext: false,
        onPort(port) {
            if (options.setContext !== false) setExtensionProxyContext(port);
        }
    });
    const sendMessageToServer: ExtensionMessageHandler = (payload) => {
        if (
            payload &&
            typeof payload === 'object' &&
            (payload as { event?: unknown }).event ===
                EXTENSION_DISCONNECT_EVENT_KEY
        ) {
            window.postMessage(
                { event: EXTENSION_DISCONNECT_EVENT_KEY },
                targetOrigin
            );
            return;
        }
        window.postMessage(
            {
                event: eventKey,
                payload,
                source: EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
            },
            targetOrigin
        );
    };
    const sendMessageToClient: ExtensionWindowMessageListener = (event) => {
        if (
            event.source !== window ||
            !isExtensionRpcEnvelope(
                event.data,
                EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY,
                eventKey
            )
        ) {
            return;
        }

        try {
            channel.post(event.data.payload);
        } catch {
            // Port disconnections are expected while panels close or tabs reload.
        }
    };

    channel.on(sendMessageToServer);
    window.addEventListener('message', sendMessageToClient);
    const unsubscribe = channel.subscribeDisconnect?.(() =>
        window.postMessage(
            { event: EXTENSION_DISCONNECT_EVENT_KEY },
            targetOrigin
        )
    );
    return {
        on() {},
        post() {},
        dispose() {
            unsubscribe?.();
            channel.dispose?.();
            window.removeEventListener?.('message', sendMessageToClient);
        }
    };
}
