import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';
import {
    EXTENSION_RPC_EVENT_KEY,
    EXTENSION_RPC_MESSAGE_SOURCE,
    connectExtensionPort,
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
    const port = connectExtensionPort(
        chrome,
        options.portName ?? 'content-script'
    );

    if (!port) {
        return createNoopChannel();
    }

    if (options.setContext !== false) {
        setExtensionProxyContext(port);
    }

    const sendMessageToServer: ExtensionMessageHandler = (payload) => {
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
            !isExtensionRpcEnvelope(
                event.data,
                EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY,
                eventKey
            )
        ) {
            return;
        }

        try {
            port.postMessage(event.data.payload);
        } catch {
            // Port disconnections are expected while panels close or tabs reload.
        }
    };

    port.onMessage.addListener(sendMessageToServer);
    window.addEventListener('message', sendMessageToClient);
    port.onDisconnect.addListener(() => {
        port.onMessage.removeListener?.(sendMessageToServer);
        window.removeEventListener?.('message', sendMessageToClient);
    });

    return {
        on() {},
        post() {}
    };
}
