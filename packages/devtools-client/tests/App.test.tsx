import { act, render, screen, waitFor } from '@testing-library/react';
import {
    addCustomTab,
    resetDevToolsPluginRegistry,
    setupDevToolsPlugin
} from '@devtools/kit';
import { App, resetClientRouteRegistryForTests } from '../src';

describe('@devtools/client App routing', () => {
    afterEach(() => {
        resetClientRouteRegistryForTests();
        resetDevToolsPluginRegistry();
    });

    it.each([
        [
            '/overview',
            'Overview',
            'High-level runtime and connection overview.'
        ],
        [
            '/components',
            'Components',
            'React component tree and selected state surface.'
        ],
        [
            '/timeline',
            'Timeline',
            'Timeline route reserved for future profiling work.'
        ],
        ['/settings', 'Settings', 'Panel preferences and plugin settings.']
    ])('renders %s', (path, heading, summary) => {
        render(<App initialEntries={[path]} />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: heading })
        ).toBeInTheDocument();
        expect(screen.getByLabelText(`${heading} page`)).toHaveTextContent(
            summary
        );
    });

    it('redirects the root route to overview', () => {
        render(<App initialEntries={['/']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
    });

    it('renders a not found page for unknown routes', () => {
        render(<App initialEntries={['/missing']} />);

        expect(
            screen.getByRole('heading', { name: 'Not found' })
        ).toBeInTheDocument();
    });

    it('adds custom tabs from the plugin API as navigable routes', async () => {
        addCustomTab({
            name: 'module-health',
            title: 'Module Health'
        });

        render(<App initialEntries={['/custom-tab-view/module-health']} />);

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Module Health' })
            ).toBeInTheDocument();
        });
        expect(
            screen.getByRole('heading', { name: 'Module Health' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Module Health page')).toHaveTextContent(
            'Custom tab registered for Module Health.'
        );
    });

    it('adds custom inspectors registered by setupDevToolsPlugin as navigable tabs', async () => {
        render(
            <App
                initialEntries={['/custom-inspector-tab-view/nekuta-inspector']}
            />
        );

        act(() => {
            setupDevToolsPlugin(
                {
                    id: 'nekuta',
                    label: 'Nekuta'
                },
                (api) => {
                    api.addInspector({
                        id: 'nekuta-inspector',
                        label: 'Nekuta Inspector'
                    });
                }
            );
        });

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Nekuta Inspector' })
            ).toBeInTheDocument();
        });
        expect(
            screen.getByRole('heading', { name: 'Nekuta Inspector' })
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Nekuta Inspector page')
        ).toHaveTextContent(
            'Custom inspector registered for Nekuta Inspector.'
        );
    });

    it('can render without the default memory router wrapper', () => {
        render(<App router="none" />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
    });
});
