import {
    DEFAULT_CLIENT_URL,
    IFRAME_ID,
    createIframeTransport,
    createLazyIframeController,
    iframeRpcTypes
} from '../src/iframeTransport';

function createMockContentWindow() {
    return {
        postMessage: jest.fn()
    } as unknown as Window;
}

describe('createLazyIframeController', () => {
    it('creates exactly one iframe and toggles visibility without recreating it', () => {
        const controller = createLazyIframeController({
            clientUrl: '/devtools-client/'
        });

        const firstIframe = controller.setVisible(true);
        const secondIframe = controller.setVisible(false);
        const thirdIframe = controller.setVisible(true);

        expect(firstIframe).toBe(secondIframe);
        expect(secondIframe).toBe(thirdIframe);
        expect(firstIframe).toHaveAttribute('id', IFRAME_ID);
        expect(firstIframe).toHaveAttribute('src', '/devtools-client/');
        expect(firstIframe).toHaveAttribute('title', 'React DevTools');
        expect(firstIframe).not.toHaveAttribute('hidden');

        controller.setVisible(false);

        expect(firstIframe).toHaveAttribute('hidden');
    });

    it('connects the iframe transport after the iframe loads', async () => {
        const onConnect = jest.fn();
        const iframeWindow = createMockContentWindow();
        const controller = createLazyIframeController({ onConnect });
        const iframe = controller.getIframe();

        Object.defineProperty(iframe, 'contentWindow', {
            configurable: true,
            value: iframeWindow
        });

        iframe.dispatchEvent(new Event('load'));
        await controller.connect();

        expect(iframe).toHaveAttribute('src', DEFAULT_CLIENT_URL);
        expect(iframeWindow.postMessage).toHaveBeenCalledWith(
            { type: iframeRpcTypes.ready },
            '*'
        );
        expect(onConnect).toHaveBeenCalledWith(
            expect.objectContaining({ iframe })
        );
    });
});

describe('createIframeTransport', () => {
    it('resolves an RPC call from a matching iframe response message', async () => {
        const iframe = document.createElement('iframe');
        const iframeWindow = createMockContentWindow();

        Object.defineProperty(iframe, 'contentWindow', {
            configurable: true,
            value: iframeWindow
        });

        const transport = createIframeTransport(iframe);
        const responsePromise = transport.call('ping', { ok: true });
        const request = (iframeWindow.postMessage as jest.Mock).mock
            .calls[0][0];

        window.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    id: request.id,
                    payload: 'pong',
                    type: iframeRpcTypes.response
                }
            })
        );

        await expect(responsePromise).resolves.toBe('pong');
        expect(request).toEqual({
            id: expect.any(String),
            method: 'ping',
            payload: { ok: true },
            type: iframeRpcTypes.request
        });
    });
});
