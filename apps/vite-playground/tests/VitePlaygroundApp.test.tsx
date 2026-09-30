import { act, render, screen } from '@testing-library/react';
import {
    editCustomInspectorState,
    getCustomCommands,
    sendCustomInspectorState,
    sendCustomInspectorTree
} from '@devtools/kit';
import { registerNekutaDevTools } from '@devtools/nekuta-plugin';
import { AssetExplorerFixtures } from '../src/AssetExplorerFixtures';
import { CustomPluginPlayground } from '../src/CustomPluginPlayground';
import { MultiRootStressPlayground } from '../src/MultiRootStressPlayground';
import { NekutaDemos } from '../src/NekutaDemos';
import {
    ClassStateDemo,
    ContextProviderDemo,
    ErrorBoundaryDemo,
    FiberShapeDemo,
    MemoStatusDemo,
    PlainReactDemos,
    ReducerCounterDemo,
    StateCounterDemo,
    SuspenseLazyDemo
} from '../src/PlainReactDemos';
import { ReactRouterDemo } from '../src/ReactRouterDemo';
import { VitePlaygroundApp } from '../src/VitePlaygroundApp';

describe('Vite playground app', () => {
    it('renders the Vite playground shell and fixture surface', async () => {
        render(<VitePlaygroundApp />);

        expect(
            screen.getByRole('heading', {
                name: 'React DevTools Vite Playground'
            })
        ).toBeInTheDocument();
        expect(screen.getByText('Plain React fixtures')).toBeInTheDocument();
        expect(screen.getByText('Asset explorer fixtures')).toBeInTheDocument();
        expect(
            screen.getByText('Multi-root, portal, and stress fixtures')
        ).toBeInTheDocument();
        expect(
            screen.getByText('Custom plugin API playground')
        ).toBeInTheDocument();
        expect(screen.getByText('React Router fixtures')).toBeInTheDocument();
        expect(screen.getByText('Nekuta store fixtures')).toBeInTheDocument();
        expect(await screen.findByTestId('lazy-panel')).toBeInTheDocument();
    });

    it('renders the React Router adapter playground fixture', () => {
        render(<ReactRouterDemo />);

        expect(screen.getByText('React Router fixtures')).toBeInTheDocument();
        expect(screen.getByTestId('router-team-route')).toHaveTextContent(
            'React Router route records'
        );

        act(() => {
            screen.getByRole('link', { name: 'Settings' }).click();
        });

        expect(screen.getByTestId('router-settings-route')).toHaveTextContent(
            'Settings route rendered'
        );
    });
});

describe('custom plugin Vite playground', () => {
    it('registers fake plugin inspectors, commands, custom tabs, and editable state', async () => {
        render(<CustomPluginPlayground />);

        expect(
            await screen.findByText('Custom plugin fixtures registered')
        ).toBeInTheDocument();
        expect(
            screen.getByTestId('custom-plugin-inspector-count')
        ).toHaveTextContent('1');
        expect(
            screen.getByTestId('custom-plugin-node-count')
        ).toHaveTextContent('4');
        expect(
            screen.getByTestId('custom-plugin-command-count')
        ).toHaveTextContent('1');
        expect(screen.getByTestId('custom-plugin-tab-count')).toHaveTextContent(
            '2'
        );
        expect(
            screen.getByTestId('custom-plugin-editable-label')
        ).toHaveTextContent('Vite dogfood plugin');

        await act(async () => {
            screen
                .getByRole('button', {
                    name: 'Edit inspector label'
                })
                .click();
        });

        expect(screen.getByTestId('custom-plugin-status')).toHaveTextContent(
            'Editable inspector state updated'
        );
        expect(
            screen.getByTestId('custom-plugin-editable-label')
        ).toHaveTextContent('Edited from playground');
    });

    it('handles filtered trees, index edits, ignored edits, and command actions', async () => {
        render(<CustomPluginPlayground />);

        expect(
            await screen.findByText('Custom plugin fixtures registered')
        ).toBeInTheDocument();

        const filteredTree = await sendCustomInspectorTree(
            'vite-custom-plugin-inspector',
            'command'
        );
        expect(filteredTree.rootNodes).toHaveLength(1);
        expect(filteredTree.rootNodes[0].children).toHaveLength(1);
        expect(filteredTree.rootNodes[0].children?.[0].id).toBe('commands');

        await editCustomInspectorState({
            inspectorId: 'vite-custom-plugin-inspector',
            nodeId: 'plugin-root',
            path: ['Plugin', 0],
            state: { value: 'Edited by index' },
            type: 'set'
        });

        await editCustomInspectorState({
            inspectorId: 'vite-custom-plugin-inspector',
            nodeId: 'missing-node',
            path: ['Plugin', 'label'],
            state: { value: 'Ignored missing node' },
            type: 'set'
        });

        await editCustomInspectorState({
            inspectorId: 'vite-custom-plugin-inspector',
            nodeId: 'plugin-root',
            path: ['Dogfood', 'commands'],
            state: { value: 99 },
            type: 'set'
        });

        await getCustomCommands()[0].action?.();

        const state = await sendCustomInspectorState(
            'vite-custom-plugin-inspector',
            'plugin-root'
        );
        expect(state.state.Plugin[0].value).toBe('Edited by index');
        expect(state.state.Dogfood[0].value).toBe(1);
    });
});

describe('Nekuta Vite playground demos', () => {
    beforeEach(() => {
        jest.mocked(registerNekutaDevTools).mockReset();
    });

    it('registers the Nekuta DevTools plugin and renders Vite stores', () => {
        render(<NekutaDemos />);

        expect(registerNekutaDevTools).toHaveBeenCalledWith({
            label: 'Nekuta Vite Playground',
            nekuta: expect.objectContaining({
                _s: expect.any(Map)
            })
        });
        expect(
            screen.getByRole('heading', { name: 'Nekuta counter store' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Nekuta todo store' })
        ).toBeInTheDocument();
        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '0'
        );
        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('1');
    });

    it('updates the counter store through Nekuta actions', () => {
        render(<NekutaDemos />);

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '1'
        );
        expect(screen.getByTestId('nekuta-counter-doubled')).toHaveTextContent(
            '2'
        );

        act(() => {
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '0'
        );
    });

    it('updates the todo store through Nekuta actions', () => {
        render(<NekutaDemos />);

        act(() => {
            screen.getByRole('button', { name: 'Add todo' }).click();
        });

        expect(screen.getByTestId('nekuta-todo-list')).toHaveTextContent(
            'Review panel edit'
        );
        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('2');

        act(() => {
            screen.getByRole('button', { name: 'Toggle first todo' }).click();
        });

        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('1');
    });

    it('mounts standalone Nekuta store cards for focused UAT checks', () => {
        render(<NekutaDemos />);

        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '0'
        );
        expect(screen.getByTestId('nekuta-todo-list')).toHaveTextContent(
            'Open the Nekuta custom inspector'
        );
    });
});

describe('plain React playground demos', () => {
    it('mounts the useState component and updates local state', () => {
        render(<StateCounterDemo />);

        expect(screen.getByTestId('state-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('state-count')).toHaveTextContent('1');

        act(() => {
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('state-count')).toHaveTextContent('0');
    });

    it('mounts the useReducer component and dispatches actions', () => {
        render(<ReducerCounterDemo />);

        expect(screen.getByTestId('reducer-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
            screen.getByRole('button', { name: 'Decrement' }).click();
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('reducer-count')).toHaveTextContent('0');
    });

    it('mounts the useContext provider and updates the provided value', () => {
        render(<ContextProviderDemo />);

        expect(screen.getByTestId('context-values')).toHaveTextContent('quiet');
        expect(screen.getByTestId('context-values')).toHaveTextContent('en-US');
        expect(screen.getByTestId('context-values')).toHaveTextContent(
            'anonymous-nested'
        );

        act(() => {
            screen.getByRole('button', { name: 'Set active' }).click();
            screen.getByRole('button', { name: 'Set French Canada' }).click();
        });

        expect(screen.getByTestId('context-values')).toHaveTextContent(
            'active'
        );
        expect(screen.getByTestId('context-values')).toHaveTextContent('fr-CA');

        act(() => {
            screen.getByRole('button', { name: 'Set quiet' }).click();
            screen.getByRole('button', { name: 'Set US English' }).click();
        });

        expect(screen.getByTestId('context-values')).toHaveTextContent('quiet');
        expect(screen.getByTestId('context-values')).toHaveTextContent('en-US');
    });

    it('mounts the memo component and keeps its own interaction state', () => {
        render(<MemoStatusDemo label="Memo status" />);

        expect(screen.getByTestId('memo-status')).toHaveTextContent(
            'Memo status: idle'
        );

        act(() => {
            screen.getByRole('button', { name: 'Toggle memo state' }).click();
        });

        expect(screen.getByTestId('memo-status')).toHaveTextContent(
            'Memo status: selected'
        );
    });

    it('mounts explicit Fiber shape fixtures', () => {
        render(<FiberShapeDemo />);

        expect(screen.getByTestId('fiber-forward-ref')).toHaveTextContent(
            'forwardRef child'
        );
        expect(screen.getAllByTestId('fiber-shape-row')).toHaveLength(3);
    });

    it('mounts the Suspense boundary and resolves the lazy child', async () => {
        render(<SuspenseLazyDemo />);

        expect(await screen.findByTestId('lazy-panel')).toHaveTextContent(
            'Lazy child resolved'
        );
    });

    it('mounts the class component and updates this.state', () => {
        render(<ClassStateDemo />);

        expect(screen.getByTestId('class-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('class-count')).toHaveTextContent('1');
    });

    it('mounts the error boundary fixture and captures thrown errors', () => {
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<ErrorBoundaryDemo />);

        try {
            expect(screen.getByTestId('boundary-child')).toHaveTextContent(
                'healthy'
            );

            act(() => {
                screen.getByRole('button', { name: 'Trigger error' }).click();
            });

            expect(screen.getByTestId('boundary-fallback')).toHaveTextContent(
                'Playground boundary failure'
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('renders the combined fixture surface', async () => {
        render(<PlainReactDemos />);

        expect(screen.getByText('useState component')).toBeInTheDocument();
        expect(screen.getByText('useReducer component')).toBeInTheDocument();
        expect(
            screen.getByText('nested context providers')
        ).toBeInTheDocument();
        expect(screen.getByText('memo component')).toBeInTheDocument();
        expect(screen.getByText('Fiber shape fixtures')).toBeInTheDocument();
        expect(screen.getByText('Suspense boundary')).toBeInTheDocument();
        expect(screen.getByText('error boundary fixture')).toBeInTheDocument();
        expect(screen.getByText('class component')).toBeInTheDocument();
        expect(await screen.findByTestId('lazy-panel')).toBeInTheDocument();
    });
});

describe('asset explorer playground fixtures', () => {
    it('renders imported image and text assets for the Vite asset explorer', () => {
        render(<AssetExplorerFixtures />);

        expect(screen.getByTestId('asset-fixture-image')).toHaveAttribute(
            'src',
            'test-file-stub'
        );
        expect(screen.getByTestId('asset-fixture-manifest')).toHaveTextContent(
            'vite-asset-fixture: svg, json, txt'
        );
        expect(screen.getByTestId('asset-fixture-notes')).toHaveTextContent(
            'test-file-stub'
        );
    });
});

describe('multi-root stress playground fixtures', () => {
    it('renders multiple React roots and controls their lifecycle', async () => {
        render(<MultiRootStressPlayground />);

        expect(screen.getByTestId('dynamic-root-count')).toHaveTextContent(
            '2 dynamic roots mounted'
        );
        expect(
            await screen.findAllByTestId('dynamic-root-content')
        ).toHaveLength(2);

        act(() => {
            screen.getByRole('button', { name: 'Add root' }).click();
        });

        expect(screen.getByTestId('dynamic-root-count')).toHaveTextContent(
            '3 dynamic roots mounted'
        );
        expect(
            await screen.findAllByTestId('dynamic-root-content')
        ).toHaveLength(3);

        act(() => {
            screen.getByRole('button', { name: 'Remove root' }).click();
        });

        expect(screen.getByTestId('dynamic-root-count')).toHaveTextContent(
            '2 dynamic roots mounted'
        );
        expect(
            await screen.findAllByTestId('dynamic-root-content')
        ).toHaveLength(2);
    });

    it('renders portal, iframe, and large tree stress fixtures', () => {
        render(<MultiRootStressPlayground />);

        expect(screen.getByTestId('portal-target')).toContainElement(
            screen.getByTestId('portal-child')
        );
        expect(screen.getByTestId('iframe-root-frame')).toHaveAttribute(
            'title',
            'Iframe React root fixture'
        );
        expect(screen.getByTestId('stress-node-count')).toHaveTextContent(
            '180'
        );
        expect(screen.getAllByTestId('stress-tree-node')).toHaveLength(180);
    });
});
