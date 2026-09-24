import {
    act,
    createEvent,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import {
    addCustomTab,
    resetDevToolsPluginRegistry,
    setupDevToolsPlugin
} from '@devtools/kit';
import {
    App,
    resetClientRouteRegistryForTests,
    setClientRouteEnvironment
} from '../src';

describe('@devtools/client App routing', () => {
    afterEach(() => {
        window.localStorage.clear();
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

    it('hides Vite and adapter tabs until matching capabilities are detected', () => {
        const { queryByRole } = render(<App initialEntries={['/overview']} />);

        expect(queryByRole('link', { name: 'Assets' })).not.toBeInTheDocument();
        expect(
            queryByRole('link', { name: 'React Router' })
        ).not.toBeInTheDocument();
        expect(
            queryByRole('link', { name: 'Pages/Routes' })
        ).not.toBeInTheDocument();
    });

    it('shows Vite-only tabs when the active transport is Vite', () => {
        setClientRouteEnvironment({
            capabilities: ['source-inspector'],
            transport: 'vite'
        });

        render(<App initialEntries={['/graph']} />);

        expect(
            screen.getByRole('link', { name: 'Assets' })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Graph' })).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Source Inspector' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Graph page')).toHaveTextContent(
            'Vite module graph and dependency edges.'
        );
    });

    it('keeps source inspector gated when only the Vite transport is detected', () => {
        setClientRouteEnvironment({ transport: 'vite' });

        render(<App initialEntries={['/source-inspector']} />);

        expect(
            screen.queryByRole('link', { name: 'Source Inspector' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Not found' })
        ).toBeInTheDocument();
    });

    it('shows adapter routes after integration detection', () => {
        setClientRouteEnvironment({
            capabilities: ['react-router'],
            transport: 'standalone'
        });

        render(<App initialEntries={['/react-router']} />);

        expect(
            screen.getByRole('link', { name: 'Pages/Routes' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'React Router' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('React Router page')).toHaveTextContent(
            'React Router route tree and navigation state.'
        );
    });

    it('adds custom tabs from the plugin API as navigable routes', async () => {
        addCustomTab({
            category: 'third-party',
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

    it('groups unknown plugin tabs under the generic custom tab bucket', async () => {
        addCustomTab({
            category: 'unknown',
            name: 'feature-flags',
            title: 'Feature Flags'
        });

        const { container } = render(
            <App initialEntries={['/custom-tab-view/feature-flags']} />
        );

        await waitFor(() => {
            expect(
                screen.getByRole('link', { name: 'Feature Flags' })
            ).toBeInTheDocument();
        });
        expect(
            container.querySelector('[data-route-category="custom"]')
        ).toHaveTextContent('Feature Flags');
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

    it('toggles the client theme from the shell header', () => {
        render(<App initialEntries={['/overview']} />);

        const themeToggle = screen.getByRole('button', { name: 'Dark' });
        const themeRoot = themeToggle.closest('.dt-ui');

        expect(themeRoot).toHaveAttribute('data-theme', 'dark');

        fireEvent.click(themeToggle);

        expect(themeRoot).toHaveAttribute('data-theme', 'light');
        expect(
            screen.getByRole('button', { name: 'Light' })
        ).toBeInTheDocument();
    });

    it('renders the components split-pane layout', () => {
        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Component details' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('separator', { name: 'Resize panes' })
        ).toHaveAttribute('aria-valuenow', '42');
    });

    it('syncs selected component state from the route and updates details after selection', () => {
        render(
            <App
                initialEntries={[
                    '/components?componentId=component-group-0-child-5'
                ]}
            />
        );

        expect(screen.getAllByText('ComponentLeaf0_5')).toHaveLength(2);
        expect(
            screen.getByText('component-group-0-child-5')
        ).toBeInTheDocument();

        const nextTreeLabel = screen.getAllByText('ComponentLeaf0_6')[0];
        fireEvent.click(nextTreeLabel.closest('button') as Element);

        expect(screen.getAllByText('ComponentLeaf0_6')).toHaveLength(2);
        expect(
            screen.getByText('component-group-0-child-6')
        ).toBeInTheDocument();
    });

    it('persists the last selected tab and per-tab path state', async () => {
        const { unmount } = render(
            <App
                initialEntries={[
                    '/components?componentId=component-group-0-child-5'
                ]}
            />
        );

        await waitFor(() => {
            expect(
                window.localStorage.getItem('devtools.client.lastRoute')
            ).toBe('/components');
        });
        expect(
            JSON.parse(
                window.localStorage.getItem('devtools.client.tabState') ?? '{}'
            )
        ).toMatchObject({
            components: {
                path: '/components?componentId=component-group-0-child-5'
            }
        });

        unmount();
        render(<App initialEntries={['/']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
    });

    it('updates and persists the components split ratio after dragging the divider', () => {
        const { unmount } = render(<App initialEntries={['/components']} />);
        const splitPane = screen.getByRole('region', {
            name: 'Resizable split pane'
        });
        const divider = screen.getByRole('separator', {
            name: 'Resize panes'
        });

        jest.spyOn(splitPane, 'getBoundingClientRect').mockReturnValue({
            bottom: 420,
            height: 420,
            left: 100,
            right: 900,
            top: 0,
            width: 800,
            x: 100,
            y: 0,
            toJSON: () => ({})
        });

        const pointerDown = createPointerEvent(divider, 'pointerDown', {
            clientX: 500,
            pointerId: 1
        });
        const pointerMove = createPointerEvent(window, 'pointerMove', {
            clientX: 700
        });

        fireEvent(divider, pointerDown);
        fireEvent(window, pointerMove);
        fireEvent.pointerUp(window);

        expect(divider).toHaveAttribute('aria-valuenow', '75');
        expect(
            window.localStorage.getItem('devtools.client.components.splitRatio')
        ).toBe('0.75');

        unmount();
        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('separator', { name: 'Resize panes' })
        ).toHaveAttribute('aria-valuenow', '75');
    });
});

function createPointerEvent(
    target: Window | Element,
    eventName: 'pointerDown' | 'pointerMove',
    init: { clientX: number; pointerId?: number }
) {
    const event = createEvent[eventName](target);

    Object.defineProperties(event, {
        clientX: { value: init.clientX },
        pointerId: { value: init.pointerId ?? 1 }
    });

    return event;
}
