import {
    DEVTOOLS_PLUGIN_TYPE_CONTRACT_VERSION,
    type CustomInspectorNode,
    type CustomInspectorOptions,
    type DevToolsPlugin,
    type InspectorState,
    type PluginDescriptor,
    type RouterAdapter,
    type RouterCurrentRoute,
    type RouterRouteNode
} from '../src/index.js';

interface FiberMetadata {
    rendererId: number;
    source?: string;
}

interface NekutaMetadata {
    queryKey: string[];
    status: 'error' | 'pending' | 'success';
}

function expectAssignable<T>(_value: T) {}

describe('plugin and inspector public types', () => {
    it('exports the plugin type contract marker', () => {
        expect(DEVTOOLS_PLUGIN_TYPE_CONTRACT_VERSION).toBe(1);
    });

    it('accepts plugin descriptors with settings', () => {
        const descriptor = {
            homepage: 'https://example.test/devtools-plugin',
            id: 'react-components',
            label: 'React Components',
            logo: 'data:image/svg+xml,<svg />',
            packageName: '@devtools/react-components',
            settings: {
                enabled: {
                    defaultValue: true,
                    label: 'Enabled',
                    type: 'boolean'
                },
                density: {
                    component: 'button-group',
                    defaultValue: 'comfortable',
                    label: 'Density',
                    options: [
                        { label: 'Compact', value: 'compact' },
                        { label: 'Comfortable', value: 'comfortable' }
                    ],
                    type: 'choice'
                },
                limit: {
                    defaultValue: 100,
                    label: 'Limit',
                    min: 1,
                    step: 1,
                    type: 'number'
                }
            }
        } satisfies PluginDescriptor;

        expectAssignable<PluginDescriptor>(descriptor);
        expect(descriptor.id).toBe('react-components');
    });

    it('accepts generic fiber-tree inspector nodes and state groups', () => {
        const options = {
            icon: 'component',
            id: 'fiber-tree',
            label: 'Fiber Tree',
            stateFilterPlaceholder: 'Filter hooks',
            treeFilterPlaceholder: 'Filter components'
        } satisfies CustomInspectorOptions;
        const node = {
            children: [
                {
                    id: 'fiber:2',
                    label: 'button',
                    metadata: { rendererId: 1 }
                }
            ],
            id: 'fiber:1',
            label: 'App',
            metadata: { rendererId: 1, source: 'src/App.tsx' },
            tags: [{ backgroundColor: '#20232a', label: 'memo' }]
        } satisfies CustomInspectorNode<FiberMetadata>;
        const state = {
            hooks: [
                {
                    editable: true,
                    key: 'useState[0]',
                    value: { count: 1 }
                }
            ],
            props: [{ key: 'title', value: 'Dashboard' }]
        } satisfies InspectorState<'hooks' | 'props'>;

        expectAssignable<CustomInspectorOptions>(options);
        expectAssignable<CustomInspectorNode<FiberMetadata>>(node);
        expectAssignable<InspectorState<'hooks' | 'props'>>(state);
        expect(node.children?.[0]?.metadata.rendererId).toBe(1);
    });

    it('accepts Nekuta-style custom inspector metadata without changing the contract', () => {
        const node = {
            id: 'query:["todos"]',
            label: 'todos',
            metadata: {
                queryKey: ['todos'],
                status: 'success'
            }
        } satisfies CustomInspectorNode<NekutaMetadata>;
        const state = {
            query: [
                { key: 'status', value: 'success' },
                { editable: false, key: 'updatedAt', value: 1_725_000_000 }
            ]
        } satisfies InspectorState<'query'>;

        expectAssignable<CustomInspectorNode<NekutaMetadata>>(node);
        expectAssignable<InspectorState<'query'>>(state);
        expect(node.metadata.status).toBe('success');
    });

    it('accepts plugin setup functions using inspector APIs', () => {
        const plugin = {
            descriptor: {
                id: 'nekuta',
                label: 'Nekuta',
                packageName: '@devtools/nekuta'
            },
            setup(api) {
                api.registerInspector({
                    icon: 'database',
                    id: 'nekuta-queries',
                    label: 'Queries'
                });
                api.setInspectorState('nekuta-queries', 'query:["todos"]', {
                    query: [{ key: 'status', value: 'pending' }]
                });
            }
        } satisfies DevToolsPlugin<unknown, 'query'>;

        expectAssignable<DevToolsPlugin<unknown, 'query'>>(plugin);
        expect(plugin.descriptor.id).toBe('nekuta');
    });

    it('accepts framework-neutral router adapters and route actions', () => {
        const route = {
            actions: [
                {
                    source: {
                        column: 5,
                        file: 'app/routes/projects.$projectId.tsx',
                        line: 12
                    },
                    type: 'open-file'
                },
                {
                    replace: true,
                    to: '/projects/react-devtools',
                    type: 'navigate'
                }
            ],
            fullPath: '/projects/:projectId',
            id: 'project-detail',
            isActive: true,
            isExact: true,
            label: 'Project Detail',
            metadata: {
                framework: 'react-router',
                hasLoader: true
            },
            params: { projectId: 'react-devtools' },
            path: ':projectId',
            segmentType: 'dynamic'
        } satisfies RouterRouteNode;
        const currentRoute = {
            fullPath: '/projects/react-devtools?tab=routes#tree',
            hash: '#tree',
            matchedNodeIds: ['root', 'projects', 'project-detail'],
            params: { projectId: 'react-devtools' },
            pathname: '/projects/react-devtools',
            query: { tab: 'routes' },
            search: '?tab=routes'
        } satisfies RouterCurrentRoute;
        const adapter = {
            getCurrentRoute: () => currentRoute,
            getRouteTree: () => [route],
            id: 'react-router',
            kind: 'react-router',
            label: 'React Router',
            navigate: async ({ to }) => {
                expectAssignable<string>(to);
            },
            openFile: ({ source }) => {
                expectAssignable<string>(source.file);
            }
        } satisfies RouterAdapter;

        expectAssignable<RouterRouteNode>(route);
        expectAssignable<RouterCurrentRoute>(currentRoute);
        expectAssignable<RouterAdapter>(adapter);
        expect(route.actions[0]?.type).toBe('open-file');
    });
});
