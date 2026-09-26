import { act, screen } from '@testing-library/react';
import { getOverlayRuntimeConfig, mountDevtoolsOverlay } from '../src/mount';

describe('mountDevtoolsOverlay', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.__REACT_DEVTOOLS_OVERLAY_CONFIG__;
    });

    it('creates the overlay container and mounts the app', async () => {
        let mountedOverlay: ReturnType<typeof mountDevtoolsOverlay> | undefined;

        await act(async () => {
            mountedOverlay = mountDevtoolsOverlay(document);
        });

        const { container, root } = mountedOverlay!;

        expect(container).toBe(
            document.getElementById('__react-devtools-overlay__')
        );
        expect(container).toHaveAttribute(
            'data-react-devtools-overlay',
            'true'
        );
        expect(
            screen.getByRole('button', {
                name: 'Toggle React DevTools panel'
            })
        ).toBeInTheDocument();

        act(() => {
            root.unmount();
        });
        container.remove();
    });

    it('reuses an existing overlay container', async () => {
        const existingContainer = document.createElement('div');
        existingContainer.id = '__react-devtools-overlay__';
        document.body.appendChild(existingContainer);

        let mountedOverlay: ReturnType<typeof mountDevtoolsOverlay> | undefined;

        await act(async () => {
            mountedOverlay = mountDevtoolsOverlay(document);
        });

        const { container, root } = mountedOverlay!;

        expect(container).toBe(existingContainer);

        act(() => {
            root.unmount();
        });
        container.remove();
    });

    it('reads runtime URLs from the injected script attributes', () => {
        const script = document.createElement('script');
        script.setAttribute(
            'data-react-devtools-client-url',
            '/workspace/__devtools__/'
        );
        script.setAttribute(
            'data-react-devtools-separate-window-url',
            '/workspace/__devtools__/?panel=1'
        );
        document.body.appendChild(script);

        expect(getOverlayRuntimeConfig(document)).toEqual({
            clientUrl: '/workspace/__devtools__/',
            separateWindowUrl: '/workspace/__devtools__/?panel=1'
        });
    });

    it('passes global runtime config to the mounted overlay', async () => {
        window.__REACT_DEVTOOLS_OVERLAY_CONFIG__ = {
            clientUrl: '/base/__devtools__/',
            separateWindowUrl: '/base/__devtools__/?window=1'
        };

        let mountedOverlay: ReturnType<typeof mountDevtoolsOverlay> | undefined;

        await act(async () => {
            mountedOverlay = mountDevtoolsOverlay(document, {
                defaultOpen: true
            });
        });

        expect(document.querySelector('iframe')).toHaveAttribute(
            'src',
            '/base/__devtools__/'
        );
        expect(
            screen.getByRole('link', {
                name: 'Open React DevTools in separate window'
            })
        ).toHaveAttribute('href', '/base/__devtools__/?window=1');

        act(() => {
            mountedOverlay!.root.unmount();
        });
        mountedOverlay!.container.remove();
    });
});
