export const VITE_TRANSPORT_EVENT = 'react-devtools:vite-transport-message';

export type ViteTransportPayload = unknown;

export interface ViteTransportChannel {
    on: (handler: (payload: ViteTransportPayload) => void) => void;
    post: (payload: ViteTransportPayload) => void;
}

export interface ViteWsServerLike {
    on: (event: string, handler: (payload: string) => void) => void;
    send: (event: string, payload: string) => void;
}

export interface ViteTransportServerLike {
    hot?: ViteWsServerLike;
    ws?: ViteWsServerLike;
}

function getWsServer(server: ViteTransportServerLike) {
    return server.hot ?? server.ws;
}

export function serializeViteTransportPayload(payload: ViteTransportPayload) {
    return JSON.stringify(payload);
}

export function parseViteTransportPayload(payload: string) {
    return JSON.parse(payload) as ViteTransportPayload;
}

export function createViteTransportChannel(
    server: ViteTransportServerLike
): ViteTransportChannel {
    const ws = getWsServer(server);

    return {
        on(handler) {
            ws?.on(VITE_TRANSPORT_EVENT, (payload) => {
                handler(parseViteTransportPayload(payload));
            });
        },
        post(payload) {
            ws?.send(
                VITE_TRANSPORT_EVENT,
                serializeViteTransportPayload(payload)
            );
        }
    };
}
