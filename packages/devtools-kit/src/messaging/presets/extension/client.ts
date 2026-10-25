import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';
import {
    EXTENSION_DISCONNECT_EVENT_KEY,
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
    const clearReconnectTimer =
        options.clearTimeout ??
        ((timer: unknown) =>
            globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
    let reconnectTimer: unknown;
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
    let disposed = false;
    const disconnectListeners = new Set<() => void>();

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
        if (disposed) return;
        detachPort();
        let failed = false;
        try {
            port = connectExtensionPort(chrome as ChromeLike, portName);
        } catch {
            port = null;
            failed = true;
        }

        if (!port) {
            isConnected = false;
            if (failed && reconnectDelayMs !== false)
                reconnectTimer = setReconnectTimer(connect, reconnectDelayMs);
            return;
        }

        isConnected = true;
        options.onPort?.(port);

        if (options.setContext !== false) {
            setExtensionClientContext(port);
        }

        for (const listener of handlers.values()) {
            port.onMessage.addListener(listener);
        }

        disconnectHandler = () => {
            isConnected = false;
            pendingMessages.length = 0;
            detachPort();
            port = null;
            disconnectListeners.forEach((listener) => listener());

            if (reconnectDelayMs !== false) {
                reconnectTimer = setReconnectTimer(connect, reconnectDelayMs);
            }
        };
        port.onDisconnect.addListener(disconnectHandler);
        flushPendingMessages();
    };

    connect();

    return {
        subscribeDisconnect(listener) {
            disconnectListeners.add(listener);
            return () => {
                disconnectListeners.delete(listener);
            };
        },
        dispose() {
            disposed = true;
            clearReconnectTimer(reconnectTimer);
            detachPort();
            port?.disconnect?.();
            port = null;
            handlers.clear();
            disconnectListeners.clear();
            pendingMessages.length = 0;
        },
        off(handler) {
            const listener = handlers.get(handler);

            if (!listener) {
                return;
            }

            handlers.delete(handler);
            port?.onMessage.removeListener?.(listener);
        },
        on(handler) {
            if (handlers.has(handler)) return;
            const listener: ExtensionMessageHandler = (payload) => {
                if (isConnected) {
                    if (
                        payload &&
                        typeof payload === 'object' &&
                        (payload as { event?: unknown }).event ===
                            EXTENSION_DISCONNECT_EVENT_KEY
                    ) {
                        disconnectListeners.forEach((listener) => listener());
                        return;
                    }
                    handler(payload);
                }
            };

            handlers.set(handler, listener);
            port?.onMessage.addListener(listener);
        },
        post(data) {
            if (!port || !isConnected) {
                if (disposed) return;
                if (pendingMessages.length === 64) pendingMessages.shift();
                pendingMessages.push(data);
                return;
            }

            try {
                port.postMessage(data);
            } catch {
                disconnectHandler?.();
            }
        }
    };
}
