import type { RpcChannel } from '../../index.js';

export const IFRAME_RPC_EVENT_KEY = '__react-devtools-iframe-rpc__';

export type WindowMessageListener = (event: WindowMessageEvent) => void;

export interface WindowMessageEvent {
    data: unknown;
    origin: string;
    source: WindowLike | null;
}

export interface WindowLike {
    addEventListener(type: 'message', listener: WindowMessageListener): void;
    location?: {
        origin?: string;
    };
    parent?: WindowLike;
    postMessage(data: unknown, targetOrigin: string): void;
    removeEventListener?(
        type: 'message',
        listener: WindowMessageListener
    ): void;
}

export interface IframeLike {
    contentWindow?: WindowLike | null;
}

export interface IframeRpcEnvelope {
    data?: unknown;
    event: typeof IFRAME_RPC_EVENT_KEY;
    kind: 'message' | 'ready';
}

export interface CreateIframeChannelOptions {
    allowedOrigin?: string;
    eventKey?: typeof IFRAME_RPC_EVENT_KEY;
    targetOrigin?: string;
    window?: WindowLike;
}

export interface CreateIframeServerChannelOptions extends CreateIframeChannelOptions {
    iframe?: IframeLike | null;
}

export function createNoopChannel(): RpcChannel {
    return {
        on() {},
        post() {}
    };
}

export function getCurrentWindow(): WindowLike | null {
    const target = globalThis as typeof globalThis & {
        window?: WindowLike;
    };

    return target.window ?? null;
}

export function getAllowedOrigin(
    window: WindowLike,
    allowedOrigin?: string
): string {
    return allowedOrigin ?? window.location?.origin ?? '*';
}

export function getTargetOrigin(
    window: WindowLike,
    targetOrigin?: string,
    allowedOrigin?: string
): string {
    return targetOrigin ?? allowedOrigin ?? window.location?.origin ?? '*';
}

export function isIframeRpcEnvelope(
    value: unknown,
    eventKey = IFRAME_RPC_EVENT_KEY
): value is IframeRpcEnvelope {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as IframeRpcEnvelope).event === eventKey &&
        ((value as IframeRpcEnvelope).kind === 'message' ||
            (value as IframeRpcEnvelope).kind === 'ready')
    );
}

export function isAllowedOrigin(
    origin: string,
    allowedOrigin: string
): boolean {
    return allowedOrigin === '*' || origin === allowedOrigin;
}
