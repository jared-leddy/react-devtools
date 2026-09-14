import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';

export const EXTENSION_RPC_EVENT_KEY = '__react-devtools-extension-rpc__';
export const EXTENSION_CLIENT_CONTEXT_KEY =
    '__react-devtools-extension-client-context__';
export const EXTENSION_PROXY_CONTEXT_KEY =
    '__react-devtools-extension-proxy-context__';
export const EXTENSION_SERVER_CONTEXT_KEY =
    '__react-devtools-extension-server-context__';

export const EXTENSION_RPC_MESSAGE_SOURCE = {
    PROXY_TO_SERVER: 'react-devtools:proxy-to-server',
    SERVER_TO_PROXY: 'react-devtools:server-to-proxy'
} as const;

export type ExtensionMessageHandler = (payload: unknown) => void;
export type ExtensionDisconnectHandler = () => void;

export interface ExtensionEventTargetLike<
    Handler extends (...args: never[]) => void
> {
    addListener(handler: Handler): void;
    removeListener?(handler: Handler): void;
}

export interface ExtensionPortLike {
    disconnect?: () => void;
    name?: string;
    onDisconnect: ExtensionEventTargetLike<ExtensionDisconnectHandler>;
    onMessage: ExtensionEventTargetLike<ExtensionMessageHandler>;
    postMessage(payload: unknown): void;
}

export interface ExtensionRuntimeLike {
    connect(options?: { name?: string }): ExtensionPortLike;
}

export interface ExtensionDevtoolsLike {
    inspectedWindow?: {
        tabId?: number;
    };
}

export interface ChromeLike {
    devtools?: ExtensionDevtoolsLike;
    runtime?: ExtensionRuntimeLike;
}

export interface ExtensionWindowMessageEvent {
    data: unknown;
    source?: ExtensionWindowLike | null;
}

export type ExtensionWindowMessageListener = (
    event: ExtensionWindowMessageEvent
) => void;

export interface ExtensionWindowLike {
    addEventListener(
        type: 'message',
        listener: ExtensionWindowMessageListener
    ): void;
    postMessage(payload: unknown, targetOrigin: string): void;
    removeEventListener?(
        type: 'message',
        listener: ExtensionWindowMessageListener
    ): void;
}

export interface ExtensionRpcEnvelope {
    event: typeof EXTENSION_RPC_EVENT_KEY;
    payload: unknown;
    source:
        | typeof EXTENSION_RPC_MESSAGE_SOURCE.PROXY_TO_SERVER
        | typeof EXTENSION_RPC_MESSAGE_SOURCE.SERVER_TO_PROXY;
}

export interface CreateExtensionClientChannelOptions {
    chrome?: ChromeLike | null;
    portName?: string;
    reconnectDelayMs?: false | number;
    setContext?: boolean;
    setTimeout?: (handler: () => void, delay: number) => unknown;
}

export interface CreateExtensionServerChannelOptions {
    eventKey?: typeof EXTENSION_RPC_EVENT_KEY;
    targetOrigin?: string;
    window?: ExtensionWindowLike | null;
}

export interface CreateExtensionProxyChannelOptions extends CreateExtensionServerChannelOptions {
    chrome?: ChromeLike | null;
    portName?: string;
    setContext?: boolean;
}

function getTarget() {
    return globalThis as typeof globalThis & {
        [EXTENSION_CLIENT_CONTEXT_KEY]?: ExtensionPortLike;
        [EXTENSION_PROXY_CONTEXT_KEY]?: ExtensionPortLike;
        [EXTENSION_SERVER_CONTEXT_KEY]?: ExtensionWindowLike;
        chrome?: ChromeLike;
        window?: ExtensionWindowLike;
    };
}

export function getChromeRuntime(
    chrome?: ChromeLike | null
): ChromeLike | null {
    return chrome ?? getTarget().chrome ?? null;
}

export function getExtensionWindow(
    window?: ExtensionWindowLike | null
): ExtensionWindowLike | null {
    return window ?? getTarget().window ?? null;
}

export function getExtensionClientContext(): ExtensionPortLike | null {
    return getTarget()[EXTENSION_CLIENT_CONTEXT_KEY] ?? null;
}

export function setExtensionClientContext(port: ExtensionPortLike): void {
    getTarget()[EXTENSION_CLIENT_CONTEXT_KEY] = port;
}

export function clearExtensionClientContext(): void {
    delete getTarget()[EXTENSION_CLIENT_CONTEXT_KEY];
}

export function getExtensionProxyContext(): ExtensionPortLike | null {
    return getTarget()[EXTENSION_PROXY_CONTEXT_KEY] ?? null;
}

export function setExtensionProxyContext(port: ExtensionPortLike): void {
    getTarget()[EXTENSION_PROXY_CONTEXT_KEY] = port;
}

export function clearExtensionProxyContext(): void {
    delete getTarget()[EXTENSION_PROXY_CONTEXT_KEY];
}

export function getExtensionServerContext(): ExtensionWindowLike | null {
    return getTarget()[EXTENSION_SERVER_CONTEXT_KEY] ?? null;
}

export function setExtensionServerContext(window: ExtensionWindowLike): void {
    getTarget()[EXTENSION_SERVER_CONTEXT_KEY] = window;
}

export function clearExtensionServerContext(): void {
    delete getTarget()[EXTENSION_SERVER_CONTEXT_KEY];
}

export function getDefaultExtensionClientPortName(
    chrome: ChromeLike | null
): string {
    return String(chrome?.devtools?.inspectedWindow?.tabId ?? 'devtools-panel');
}

export function connectExtensionPort(
    chrome: ChromeLike | null,
    portName: string
): ExtensionPortLike | null {
    return chrome?.runtime?.connect({ name: portName }) ?? null;
}

export function isExtensionRpcEnvelope(
    value: unknown,
    source: ExtensionRpcEnvelope['source'],
    eventKey = EXTENSION_RPC_EVENT_KEY
): value is ExtensionRpcEnvelope {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as ExtensionRpcEnvelope).event === eventKey &&
        (value as ExtensionRpcEnvelope).source === source &&
        'payload' in value
    );
}

export function createExtensionPortChannel(
    port: ExtensionPortLike | null | undefined
): RpcChannel {
    if (!port) {
        return createNoopChannel();
    }

    const listeners = new Map<
        (data: unknown) => void,
        ExtensionMessageHandler
    >();

    return {
        off(handler) {
            const listener = listeners.get(handler);

            if (!listener) {
                return;
            }

            listeners.delete(handler);
            port.onMessage.removeListener?.(listener);
        },
        on(handler) {
            const listener: ExtensionMessageHandler = (payload) => {
                handler(payload);
            };

            listeners.set(handler, listener);
            port.onMessage.addListener(listener);
        },
        post(data) {
            port.postMessage(data);
        }
    };
}
