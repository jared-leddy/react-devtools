import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';

export const VITE_RPC_EVENT_KEY = 'react-devtools:vite-rpc-message';
export const VITE_CLIENT_CONTEXT_KEY = '__react-devtools-vite-client-context__';
export const VITE_SERVER_CONTEXT_KEY = '__react-devtools-vite-server-context__';
export const DEFAULT_VITE_HOT_CONTEXT_PATH = '/____react-devtools';

export type ViteMessageHandler = (payload: unknown) => void;

export interface ViteHotContextLike {
    off?: (event: string, handler: ViteMessageHandler) => void;
    on: (event: string, handler: ViteMessageHandler) => void;
    send: (event: string, payload?: unknown) => void;
}

export interface ViteWebSocketLike {
    off?: (event: string, handler: ViteMessageHandler) => void;
    on: (event: string, handler: ViteMessageHandler) => void;
    send: (event: string, payload?: unknown) => void;
}

export interface ViteServerLike {
    hot?: ViteWebSocketLike;
    ws?: ViteWebSocketLike;
}

export interface CreateViteClientChannelOptions {
    eventKey?: string;
    hot?: ViteHotContextLike | null;
}

export interface CreateViteServerChannelOptions {
    eventKey?: string;
    server?: ViteServerLike | null;
}

export interface ConnectViteClientContextOptions {
    base?: string;
    createHotContext?: (
        path?: string,
        base?: string
    ) => Promise<ViteHotContextLike | undefined>;
    path?: string;
    setContext?: boolean;
}

function getTarget() {
    return globalThis as typeof globalThis & {
        [VITE_CLIENT_CONTEXT_KEY]?: ViteHotContextLike;
        [VITE_SERVER_CONTEXT_KEY]?: ViteServerLike;
    };
}

export function getViteClientContext(): ViteHotContextLike | null {
    return getTarget()[VITE_CLIENT_CONTEXT_KEY] ?? null;
}

export function setViteClientContext(context: ViteHotContextLike): void {
    getTarget()[VITE_CLIENT_CONTEXT_KEY] = context;
}

export function clearViteClientContext(): void {
    delete getTarget()[VITE_CLIENT_CONTEXT_KEY];
}

export function getViteServerContext(): ViteServerLike | null {
    return getTarget()[VITE_SERVER_CONTEXT_KEY] ?? null;
}

export function setViteServerContext(context: ViteServerLike): void {
    getTarget()[VITE_SERVER_CONTEXT_KEY] = context;
}

export function clearViteServerContext(): void {
    delete getTarget()[VITE_SERVER_CONTEXT_KEY];
}

export function getViteServerWebSocket(
    server: ViteServerLike | null | undefined
): ViteWebSocketLike | null {
    return server?.hot ?? server?.ws ?? null;
}

export function createViteHotChannel(
    hot: ViteHotContextLike | ViteWebSocketLike | null | undefined,
    eventKey = VITE_RPC_EVENT_KEY
): RpcChannel {
    if (!hot) {
        return createNoopChannel();
    }

    const listeners = new Map<(data: unknown) => void, ViteMessageHandler>();

    return {
        off(handler) {
            const listener = listeners.get(handler);

            if (!listener) {
                return;
            }

            listeners.delete(handler);
            hot.off?.(eventKey, listener);
        },
        on(handler) {
            const listener: ViteMessageHandler = (payload) => {
                handler(payload);
            };

            listeners.set(handler, listener);
            hot.on(eventKey, listener);
        },
        post(data) {
            hot.send(eventKey, data);
        }
    };
}

export async function connectViteClientContext(
    options: ConnectViteClientContextOptions = {}
): Promise<ViteHotContextLike | null> {
    const createHotContext =
        options.createHotContext ??
        (await import('vite-hot-client')).createHotContext;
    const hot =
        (await createHotContext(
            options.path ?? DEFAULT_VITE_HOT_CONTEXT_PATH,
            options.base ?? '/'
        )) ?? null;

    if (hot && options.setContext !== false) {
        setViteClientContext(hot);
    }

    return hot;
}
