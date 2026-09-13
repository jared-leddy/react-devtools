import { act, screen } from '@testing-library/react';
import { mountDevtoolsOverlay } from '../src/mount';

describe('mountDevtoolsOverlay', () => {
    afterEach(() => {
        document.body.innerHTML = '';
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
});
