import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';
import {
    connectExtensionPort,
    getChromeRuntime,
    getDefaultExtensionClientPortName,
    setExtensionClientContext,
    type ChromeLike,
    type CreateExtensionClientChannelOptions,
    type ExtensionDisconnectHandler,
    type ExtensionMessageHandler,
    type ExtensionPortLike
} from './context.js';

export function createExtensionClientChannel(
    options: CreateExtensionClientChannelOptions = {}
): RpcChannel {
    const chrome = getChromeRuntime(options.chrome);

    if (!chrome?.runtime) {
        return createNoopChannel();
    }

    const reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    const setReconnectTimer = options.setTimeout ?? globalThis.setTimeout;
    const portName =
        options.portName ?? getDefaultExtensionClientPortName(chrome);
    const handlers = new Map<
        (data: unknown) => void,
        ExtensionMessageHandler
    >();
    const pendingMessages: unknown[] = [];
    let disconnectHandler: ExtensionDisconnectHandler | null = null;
    let port: ExtensionPortLike | null = null;
    let isConnected = false;

    const detachPort = () => {
        if (!port) {
            return;
        }

        for (const listener of handlers.values()) {
            port.onMessage.removeListener?.(listener);
        }

        if (disconnectHandler) {
            port.onDisconnect.removeListener?.(disconnectHandler);
        }
    };

    const flushPendingMessages = () => {
        while (port && isConnected && pendingMessages.length > 0) {
            port.postMessage(pendingMessages.shift());
        }
    };

    const connect = () => {
        detachPort();
        port = connectExtensionPort(chrome as ChromeLike, portName);

        if (!port) {
            isConnected = false;
            return;
        }

        isConnected = true;

        if (options.setContext !== false) {
            setExtensionClientContext(port);
        }

        for (const listener of handlers.values()) {
            port.onMessage.addListener(listener);
        }

        disconnectHandler = () => {
            isConnected = false;
            detachPort();
            port = null;

            if (reconnectDelayMs !== false) {
                setReconnectTimer(connect, reconnectDelayMs);
            }
        };
        port.onDisconnect.addListener(disconnectHandler);
        flushPendingMessages();
    };

    connect();

    return {
        off(handler) {
            const listener = handlers.get(handler);

            if (!listener) {
                return;
            }

            handlers.delete(handler);
            port?.onMessage.removeListener?.(listener);
        },
        on(handler) {
            const listener: ExtensionMessageHandler = (payload) => {
                if (isConnected) {
                    handler(payload);
                }
            };

            handlers.set(handler, listener);
            port?.onMessage.addListener(listener);
        },
        post(data) {
            if (!port || !isConnected) {
                pendingMessages.push(data);
                return;
            }

            port.postMessage(data);
        }
    };
}
