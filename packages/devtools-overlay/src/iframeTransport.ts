export const DEFAULT_CLIENT_URL = '/__devtools__/';
export const IFRAME_ID = 'react-devtools-iframe';

const REQUEST_TYPE = 'react-devtools:iframe-rpc-request';
const RESPONSE_TYPE = 'react-devtools:iframe-rpc-response';
const READY_TYPE = 'react-devtools:iframe-ready';

export type IframeRpcPayload = unknown;

export interface IframeRpcRequest {
    id: string;
    method: string;
    payload?: IframeRpcPayload;
    type: typeof REQUEST_TYPE;
}

export interface IframeRpcResponse {
    id: string;
    payload?: IframeRpcPayload;
    type: typeof RESPONSE_TYPE;
}

export interface IframeTransport {
    call: (
        method: string,
        payload?: IframeRpcPayload
    ) => Promise<IframeRpcPayload>;
    connect: () => Promise<void>;
    iframe: HTMLIFrameElement;
}

export interface LazyIframeController {
    connect: () => Promise<void>;
    getIframe: () => HTMLIFrameElement;
    setVisible: (visible: boolean) => HTMLIFrameElement;
}

function isIframeRpcResponse(message: unknown): message is IframeRpcResponse {
    return (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === RESPONSE_TYPE &&
        'id' in message &&
        typeof message.id === 'string'
    );
}

function createRequestId() {
    return `react-devtools-overlay-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

export function createIframeTransport(
    iframe: HTMLIFrameElement,
    targetWindow: Window = window
): IframeTransport {
    let connected = false;

    function connect() {
        if (connected) {
            return Promise.resolve();
        }

        connected = true;
        iframe.contentWindow?.postMessage({ type: READY_TYPE }, '*');
        return Promise.resolve();
    }

    function call(method: string, payload?: IframeRpcPayload) {
        const id = createRequestId();

        return new Promise<IframeRpcPayload>((resolve) => {
            function handleMessage(event: MessageEvent) {
                if (!isIframeRpcResponse(event.data) || event.data.id !== id) {
                    return;
                }

                targetWindow.removeEventListener('message', handleMessage);
                resolve(event.data.payload);
            }

            targetWindow.addEventListener('message', handleMessage);
            iframe.contentWindow?.postMessage(
                {
                    id,
                    method,
                    payload,
                    type: REQUEST_TYPE
                } satisfies IframeRpcRequest,
                '*'
            );
        });
    }

    return { call, connect, iframe };
}

export function createLazyIframeController({
    clientUrl = DEFAULT_CLIENT_URL,
    onConnect,
    targetDocument = document,
    targetWindow = window
}: {
    clientUrl?: string;
    onConnect?: (transport: IframeTransport) => void | Promise<void>;
    targetDocument?: Document;
    targetWindow?: Window;
} = {}): LazyIframeController {
    let iframe: HTMLIFrameElement | undefined;
    let transport: IframeTransport | undefined;
    let connectionPromise: Promise<void> | undefined;

    function getIframe() {
        if (iframe) {
            return iframe;
        }

        iframe = targetDocument.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.src = clientUrl;
        iframe.title = 'React DevTools';
        iframe.setAttribute('data-react-devtools-iframe', 'true');
        iframe.hidden = true;

        transport = createIframeTransport(iframe, targetWindow);
        iframe.addEventListener('load', () => {
            connectionPromise = transport!
                .connect()
                .then(() => onConnect?.(transport!));
        });

        return iframe;
    }

    function setVisible(visible: boolean) {
        const panelIframe = getIframe();
        panelIframe.hidden = !visible;
        return panelIframe;
    }

    function connect() {
        getIframe();
        return connectionPromise ?? Promise.resolve();
    }

    return { connect, getIframe, setVisible };
}

export const iframeRpcTypes = {
    ready: READY_TYPE,
    request: REQUEST_TYPE,
    response: RESPONSE_TYPE
} as const;
