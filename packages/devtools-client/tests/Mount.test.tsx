import { act, screen } from '@testing-library/react';
import { mountDevToolsClient, type MountedDevToolsClient } from '../src';

describe('mountDevToolsClient', () => {
    it('mounts and unmounts the client app from an embedding container', async () => {
        const container = document.createElement('div');
        document.body.append(container);
        let mounted: MountedDevToolsClient;

        await act(async () => {
            mounted = mountDevToolsClient(container);
        });

        expect(mounted!.root).toBeDefined();
        expect(
            await screen.findByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();

        act(() => {
            mounted!.unmount();
        });

        expect(
            screen.queryByRole('main', { name: 'React DevTools client' })
        ).not.toBeInTheDocument();
        container.remove();
    });
});
