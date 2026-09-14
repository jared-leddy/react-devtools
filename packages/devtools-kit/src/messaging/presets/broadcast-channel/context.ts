import type { RpcChannel } from '../../index.js';
import { createNoopChannel } from '../iframe/context.js';

export const BROADCAST_CHANNEL_RPC_EVENT_KEY =
    '__react-devtools-broadcast-channel-rpc__';
export const DEFAULT_BROADCAST_CHANNEL_SESSION_ID = 'default';
export const DEFAULT_BROADCAST_CHANNEL_NAME =
    '__react-devtools:broadcast-channel__';

export type BroadcastChannelMessageHandler = (event: { data: unknown }) => void;

export interface BroadcastChannelLike {
    addEventListener?(
        type: 'message',
        handler: BroadcastChannelMessageHandler
    ): void;
    close?: () => void;
    onmessage?: BroadcastChannelMessageHandler | null;
    postMessage(data: unknown): void;
    removeEventListener?(
        type: 'message',
        handler: BroadcastChannelMessageHandler
    ): void;
}

export interface BroadcastChannelConstructorLike {
    new (name: string): BroadcastChannelLike;
}

export interface BroadcastChannelRpcEnvelope {
    data: unknown;
    event: typeof BROADCAST_CHANNEL_RPC_EVENT_KEY;
    senderId: string;
    sessionId: string;
}

export interface CreateBroadcastChannelOptions {
    BroadcastChannel?: BroadcastChannelConstructorLike | null;
    channelName?: string;
    eventKey?: typeof BROADCAST_CHANNEL_RPC_EVENT_KEY;
    senderId?: string;
    sessionId?: string;
}

function getBroadcastChannelConstructor(
    BroadcastChannel?: BroadcastChannelConstructorLike | null
): BroadcastChannelConstructorLike | null {
    const target = globalThis as typeof globalThis & {
        BroadcastChannel?: BroadcastChannelConstructorLike;
    };

    return BroadcastChannel ?? target.BroadcastChannel ?? null;
}

export function createBroadcastChannelInstance(
    options: CreateBroadcastChannelOptions = {}
): BroadcastChannelLike | null {
    const BroadcastChannelConstructor = getBroadcastChannelConstructor(
        options.BroadcastChannel
    );

    if (!BroadcastChannelConstructor) {
        return null;
    }

    return new BroadcastChannelConstructor(
        options.channelName ?? DEFAULT_BROADCAST_CHANNEL_NAME
    );
}

export function isBroadcastChannelRpcEnvelope(
    value: unknown,
    eventKey = BROADCAST_CHANNEL_RPC_EVENT_KEY
): value is BroadcastChannelRpcEnvelope {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as BroadcastChannelRpcEnvelope).event === eventKey &&
        typeof (value as BroadcastChannelRpcEnvelope).senderId === 'string' &&
        typeof (value as BroadcastChannelRpcEnvelope).sessionId === 'string' &&
        'data' in value
    );
}

export function createBroadcastChannelRpcChannel(
    options: CreateBroadcastChannelOptions = {}
): RpcChannel {
    const channel = createBroadcastChannelInstance(options);

    if (!channel) {
        return createNoopChannel();
    }

    const eventKey = options.eventKey ?? BROADCAST_CHANNEL_RPC_EVENT_KEY;
    const senderId =
        options.senderId ??
        `sender:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
    const sessionId = options.sessionId ?? DEFAULT_BROADCAST_CHANNEL_SESSION_ID;
    const listeners = new Map<
        (data: unknown) => void,
        BroadcastChannelMessageHandler
    >();

    return {
        off(handler) {
            const listener = listeners.get(handler);

            if (!listener) {
                return;
            }

            listeners.delete(handler);
            channel.removeEventListener?.('message', listener);

            if (
                !channel.removeEventListener &&
                channel.onmessage === listener
            ) {
                channel.onmessage = null;
            }
        },
        on(handler) {
            const listener: BroadcastChannelMessageHandler = (event) => {
                if (
                    !isBroadcastChannelRpcEnvelope(event.data, eventKey) ||
                    event.data.sessionId !== sessionId ||
                    event.data.senderId === senderId
                ) {
                    return;
                }

                handler(event.data.data);
            };

            listeners.set(handler, listener);

            if (channel.addEventListener) {
                channel.addEventListener('message', listener);
            } else {
                channel.onmessage = listener;
            }
        },
        post(data) {
            channel.postMessage({
                data,
                event: eventKey,
                senderId,
                sessionId
            });
        }
    };
}
