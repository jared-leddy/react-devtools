import {
    act,
    createEvent,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import {
    addCustomCommand,
    addCustomTab,
    resetDevToolsPluginRegistry,
    removeCustomCommand,
    setupDevToolsPlugin
} from '@devtools/kit';
import {
    App,
    getClientSettingsSnapshot,
    resetClientCommandRegistryForTests,
    resetClientRuntimeForTests,
    resetClientRouteRegistryForTests,
    resetClientSettingsForTests,
    setClientSettingsStorageForTests,
    setClientSetting,
    setClientRouteEnvironment,
    setClientRuntimeState
} from '../src';

describe('@devtools/client App routing', () => {
    afterEach(() => {
        window.localStorage.clear();
        resetClientCommandRegistryForTests();
        resetClientRuntimeForTests();
        resetClientRouteRegistryForTests();
        resetClientSettingsForTests();
        resetDevToolsPluginRegistry();
        jest.restoreAllMocks();
    });

    it.each([
        [
            '/timeline',
            'Timeline',
            'Timeline route reserved for future profiling work.'
        ]
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

    it('renders the Overview tab with runtime diagnostics', () => {
        render(<App initialEntries={['/overview']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Overview page')).toHaveTextContent(
            'Standalone'
        );
        expect(screen.getByText('Primary renderer')).toBeInTheDocument();
        expect(screen.getByText('React 18.3.1')).toBeInTheDocument();
        expect(screen.getByText('App root')).toBeInTheDocument();
        expect(screen.getByText('#root')).toBeInTheDocument();
        expect(screen.getByText('Standalone client')).toBeInTheDocument();
        expect(screen.getAllByText('12.4 ms')).toHaveLength(2);
    });

    it('renders Overview diagnostics for integrations and performance settings', () => {
        addCustomTab({
            category: 'third-party',
            name: 'module-health',
            title: 'Module Health'
        });
        setClientRouteEnvironment({
            capabilities: ['react-router', 'source-inspector'],
            transport: 'vite'
        });
        setClientSetting('highPerformanceMode', true);
        setClientSetting('timelineRecording', true);

        render(<App initialEntries={['/overview']} />);

        expect(screen.getByLabelText('Overview page')).toHaveTextContent(
            'Vite'
        );
        expect(screen.getAllByText('React Router')).toHaveLength(2);
        expect(screen.getAllByText('Source Inspector')).toHaveLength(2);
        expect(screen.getAllByText('Module Health')).toHaveLength(2);
        expect(
            screen.getByText('High performance mode').nextSibling
        ).toHaveTextContent('Enabled');
        expect(
            screen.getByText('Timeline recording').nextSibling
        ).toHaveTextContent('Enabled');
    });

    it('uses Overview to explain missing React trees', () => {
        setClientRouteEnvironment({ transport: 'iframe' });
        setClientRuntimeState({
            reactStatus: 'not-detected',
            rootStatus: 'empty'
        });

        render(<App initialEntries={['/overview']} />);

        expect(
            screen.getByRole('heading', { name: 'Overview' })
        ).toBeInTheDocument();
        expect(screen.getByText('Overlay iframe')).toBeInTheDocument();
        expect(screen.getByText('No renderers detected')).toBeInTheDocument();
        expect(screen.getByText('No roots found')).toBeInTheDocument();
        expect(screen.getAllByText('No commits recorded')).toHaveLength(2);
    });

    it('renders the Settings page controls', () => {
        render(<App initialEntries={['/settings']} />);

        expect(
            screen.getByRole('heading', { name: 'Settings' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Theme')).toBeInTheDocument();
        expect(screen.getByLabelText('Panel layout')).toBeInTheDocument();
        expect(screen.getByLabelText('Settings JSON')).toBeInTheDocument();
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

    it.each([
        [
            'waiting',
            'Waiting for connection',
            'waiting-for-connection',
            'waiting for an inspected React runtime to connect'
        ],
        [
            'disconnected',
            'Runtime disconnected',
            'transport-disconnected',
            'The inspected runtime disconnected'
        ],
        [
            'reconnecting',
            'Reconnecting',
            'transport-reconnecting',
            'attempting to reconnect'
        ]
    ] as const)(
        'renders the %s connection state',
        (connectionStatus, heading, label, copy) => {
            setClientRuntimeState({ connectionStatus });

            render(<App initialEntries={['/components']} />);

            expect(
                screen.getByRole('heading', { name: heading })
            ).toBeInTheDocument();
            expect(screen.getByLabelText(label)).toHaveTextContent(copy);
        }
    );

    it('renders a no-React-detected state after connection', () => {
        setClientRuntimeState({ reactStatus: 'not-detected' });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('heading', { name: 'No React detected' })
        ).toBeInTheDocument();
        expect(screen.getByLabelText('no-react-detected')).toHaveTextContent(
            'no React renderer has been detected'
        );
    });

    it('renders an unsupported React version state', () => {
        setClientRuntimeState({
            reactStatus: 'unsupported',
            unsupportedReactVersion: '16.7.0'
        });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('heading', {
                name: 'Unsupported React version'
            })
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('unsupported-react-version')
        ).toHaveTextContent(
            'React 16.7.0 is not supported by this devtools build.'
        );
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

    it('toggles and persists the client theme from the shell header', async () => {
        render(<App initialEntries={['/overview']} />);

        const themeToggle = screen.getByRole('button', { name: 'Dark' });
        const themeRoot = themeToggle.closest('.dt-ui');

        expect(themeRoot).toHaveAttribute('data-theme', 'dark');

        fireEvent.click(themeToggle);

        await waitFor(() => {
            expect(themeRoot).toHaveAttribute('data-theme', 'light');
        });
        expect(
            screen.getByRole('button', { name: 'Light' })
        ).toBeInTheDocument();
        expect(
            window.localStorage.getItem('devtools.client.settings')
        ).toContain('"theme":"light"');
    });

    it('persists settings across remounts', () => {
        const { unmount } = render(<App initialEntries={['/settings']} />);

        fireEvent.change(screen.getByLabelText('Panel layout'), {
            target: { value: 'compact' }
        });
        fireEvent.click(screen.getByLabelText('High performance mode'));
        fireEvent.change(screen.getByLabelText('Tree filter'), {
            target: { value: 'Provider' }
        });

        expect(
            window.localStorage.getItem('devtools.client.settings')
        ).toContain('"panelLayout":"compact"');

        unmount();
        render(<App initialEntries={['/settings']} />);

        expect(screen.getByLabelText('Panel layout')).toHaveValue('compact');
        expect(screen.getByLabelText('High performance mode')).toBeChecked();
        expect(screen.getByLabelText('Tree filter')).toHaveValue('Provider');
    });

    it('imports, exports, and resets settings from the Settings page', async () => {
        render(<App initialEntries={['/settings']} />);

        fireEvent.change(screen.getByLabelText('Theme'), {
            target: { value: 'light' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Export' }));

        expect(
            (screen.getByLabelText('Settings JSON') as HTMLTextAreaElement)
                .value
        ).toContain('"theme": "light"');

        fireEvent.change(screen.getByLabelText('Settings JSON'), {
            target: {
                value: JSON.stringify({
                    highPerformanceMode: true,
                    panelLayout: 'compact',
                    reduceMotion: true,
                    stateFilter: 'hooks',
                    theme: 'dark',
                    timelineRecording: true,
                    treeFilter: 'Provider'
                })
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Import' }));

        expect(
            await screen.findByText('Settings imported.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Theme')).toHaveValue('dark');
        expect(screen.getByLabelText('Panel layout')).toHaveValue('compact');
        expect(screen.getByLabelText('Reduce motion')).toBeChecked();
        expect(screen.getByLabelText('Timeline recording')).toBeChecked();
        expect(screen.getByLabelText('State filter')).toHaveValue('hooks');

        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

        expect(screen.getByLabelText('Theme')).toHaveValue('dark');
        expect(screen.getByLabelText('Panel layout')).toHaveValue(
            'comfortable'
        );
        expect(screen.getByLabelText('Reduce motion')).not.toBeChecked();
        expect(screen.getByLabelText('Settings JSON')).toHaveValue('');
    });

    it('can persist settings through a custom storage adapter', () => {
        const values = new Map<string, string>();

        setClientSettingsStorageForTests({
            getItem: (key) => values.get(key) ?? null,
            removeItem: (key) => {
                values.delete(key);
            },
            setItem: (key, value) => {
                values.set(key, value);
            }
        });

        render(<App initialEntries={['/settings']} />);
        fireEvent.change(screen.getByLabelText('State filter'), {
            target: { value: 'stateful' }
        });

        expect(getClientSettingsSnapshot().stateFilter).toBe('stateful');
        expect(Array.from(values.values()).join('\n')).toContain(
            '"stateFilter":"stateful"'
        );
    });

    it('opens the command palette with the keyboard shortcut and filters commands', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.keyDown(window, { ctrlKey: true, key: 'k' });

        expect(
            screen.getByRole('dialog', { name: 'Command palette' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: /Go to Components/i })
        ).toBeInTheDocument();

        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'settings' }
            }
        );

        expect(
            screen.getByRole('option', { name: /Go to Settings/i })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('option', { name: /Go to Components/i })
        ).not.toBeInTheDocument();
    });

    it('runs navigation commands from the command palette', () => {
        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'settings' }
            }
        );
        fireEvent.click(
            screen.getByRole('option', { name: /Go to Settings/i })
        );

        expect(
            screen.queryByRole('dialog', { name: 'Command palette' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Settings' })
        ).toBeInTheDocument();
    });

    it('runs URL commands from the command palette', () => {
        const open = jest.spyOn(window, 'open').mockImplementation();

        render(<App initialEntries={['/overview']} />);

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'react docs' }
            }
        );
        fireEvent.click(
            screen.getByRole('option', { name: /Open React docs/i })
        );

        expect(open).toHaveBeenCalledWith(
            'https://react.dev',
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('shows nested plugin commands and removes them after unregistering', async () => {
        render(<App initialEntries={['/overview']} />);

        act(() => {
            addCustomCommand({
                children: [
                    {
                        id: 'open-child-report',
                        label: 'Open child report',
                        route: '/timeline'
                    }
                ],
                id: 'plugin-tools',
                label: 'Plugin tools'
            });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Command' }));
        fireEvent.change(
            screen.getByRole('searchbox', { name: 'Search commands' }),
            {
                target: { value: 'child report' }
            }
        );

        await waitFor(() => {
            expect(
                screen.getByRole('option', { name: /Open child report/i })
            ).toBeInTheDocument();
        });
        expect(screen.getByText('Plugins / Plugin tools')).toBeInTheDocument();

        act(() => {
            removeCustomCommand('plugin-tools');
        });

        await waitFor(() => {
            expect(
                screen.queryByRole('option', { name: /Open child report/i })
            ).not.toBeInTheDocument();
        });
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

    it('renders empty-root panes when React has no mounted components', () => {
        setClientRuntimeState({ rootStatus: 'empty' });

        render(<App initialEntries={['/components']} />);

        expect(screen.getByText('Empty React root')).toBeInTheDocument();
        expect(screen.getByText('No component selected')).toBeInTheDocument();
        expect(
            screen.getByText(
                'React is connected, but no mounted components were found in the current root.'
            )
        ).toBeInTheDocument();
    });

    it('renders a deliberate no-selection detail pane', () => {
        setClientRuntimeState({ selectionStatus: 'none' });

        render(<App initialEntries={['/components']} />);

        expect(
            screen.getByRole('region', { name: 'Component tree' })
        ).toBeInTheDocument();
        expect(screen.getByText('No component selected')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Choose a component from the tree to inspect its props, hooks, and state.'
            )
        ).toBeInTheDocument();
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
