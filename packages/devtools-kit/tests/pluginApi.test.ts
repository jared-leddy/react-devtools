import {
    DevToolsPluginAPI,
    ReactDevToolsContextHookKeys,
    createDevToolsContext,
    getPluginSettingsKey,
    getRegisteredDevToolsPlugins,
    registerDevToolsPluginContext,
    resetDevToolsPluginRegistry,
    setupDevToolsPlugin,
    setupDevtoolsPlugin,
    type PluginSettingsStorage
} from '../src/index.js';

describe('DevToolsPluginAPI', () => {
    afterEach(() => {
        resetDevToolsPluginRegistry();
    });

    it('buffers plugin setup until a devtools context and root are available', () => {
        const context = createDevToolsContext();
        const setup = jest.fn();

        setupDevToolsPlugin(
            {
                id: 'early-plugin',
                label: 'Early Plugin'
            },
            setup
        );

        expect(setup).not.toHaveBeenCalled();

        registerDevToolsPluginContext({ context, hasRoot: false });
        expect(setup).not.toHaveBeenCalled();

        registerDevToolsPluginContext({ context, hasRoot: true });
        expect(setup).toHaveBeenCalledTimes(1);
        expect(setup.mock.calls[0][0]).toBeInstanceOf(DevToolsPluginAPI);
        expect(getRegisteredDevToolsPlugins()).toHaveLength(1);
    });

    it('supports the setupDevtoolsPlugin alias', () => {
        const context = createDevToolsContext();
        const setup = jest.fn();

        registerDevToolsPluginContext({ context });
        setupDevtoolsPlugin({ id: 'alias', label: 'Alias' }, setup);

        expect(setup).toHaveBeenCalledTimes(1);
    });

    it('does not run setup more than once for the same plugin id', () => {
        const context = createDevToolsContext();
        const setup = jest.fn();

        registerDevToolsPluginContext({ context });
        setupDevToolsPlugin({ id: 'once', label: 'Once' }, setup);
        setupDevToolsPlugin({ id: 'once', label: 'Once Again' }, setup);

        expect(setup).toHaveBeenCalledTimes(1);
        expect(getRegisteredDevToolsPlugins()).toHaveLength(1);
    });

    it('adds inspectors and retrieves inspector tree callback results', async () => {
        const context = createDevToolsContext();
        const addedInspectors: unknown[] = [];
        const treeResponses: unknown[] = [];
        let api: DevToolsPluginAPI | null = null;

        context.hooks.hook(
            ReactDevToolsContextHookKeys.ADD_INSPECTOR,
            (payload) => {
                addedInspectors.push(payload);
            }
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_RESPONSE,
            (payload) => {
                treeResponses.push(payload);
            }
        );
        registerDevToolsPluginContext({ context });
        setupDevToolsPlugin(
            { id: 'tree-plugin', label: 'Tree Plugin' },
            (pluginApi) => {
                api = pluginApi as unknown as DevToolsPluginAPI;
                pluginApi.addInspector({
                    icon: 'component',
                    id: 'fiber-tree',
                    label: 'Fiber Tree'
                });
                pluginApi.on.getInspectorTree('fiber-tree', ({ filter }) => [
                    {
                        id: 'fiber:1',
                        label: filter ? `App:${filter}` : 'App'
                    }
                ]);
            }
        );

        const response = await api!.sendInspectorTree('fiber-tree', 'app');

        expect(addedInspectors).toHaveLength(1);
        expect(response).toEqual({
            inspectorId: 'fiber-tree',
            rootNodes: [{ id: 'fiber:1', label: 'App:app' }]
        });
        expect(treeResponses).toEqual([
            {
                inspectorId: 'fiber-tree',
                requestId: 'plugin:tree-plugin:tree',
                rootNodes: [{ id: 'fiber:1', label: 'App:app' }]
            }
        ]);
    });

    it('retrieves inspector state and invokes edit handlers', async () => {
        const context = createDevToolsContext();
        const stateResponses: unknown[] = [];
        const edits: unknown[] = [];
        let api: DevToolsPluginAPI | null = null;

        context.hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE,
            (payload) => {
                stateResponses.push(payload);
            }
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.EDIT_STATE_REQUEST,
            (payload) => {
                edits.push(payload);
            }
        );
        registerDevToolsPluginContext({ context });
        setupDevToolsPlugin(
            { id: 'state-plugin', label: 'State Plugin' },
            (pluginApi) => {
                api = pluginApi as unknown as DevToolsPluginAPI;
                pluginApi.on.getInspectorState('fiber-tree', ({ nodeId }) => ({
                    hooks: [{ editable: true, key: 'nodeId', value: nodeId }]
                }));
                pluginApi.on.editInspectorState('fiber-tree', (payload) => {
                    edits.push({ handled: payload.path });
                });
            }
        );

        const state = await api!.sendInspectorState('fiber-tree', 'fiber:1');
        await api!.editInspectorState({
            inspectorId: 'fiber-tree',
            nodeId: 'fiber:1',
            path: ['hooks', 0, 'value'],
            state: { value: 'fiber:2' }
        });

        expect(state).toEqual({
            inspectorId: 'fiber-tree',
            nodeId: 'fiber:1',
            state: {
                hooks: [{ editable: true, key: 'nodeId', value: 'fiber:1' }]
            }
        });
        expect(stateResponses).toEqual([
            {
                inspectorId: 'fiber-tree',
                nodeId: 'fiber:1',
                requestId: 'plugin:state-plugin:state',
                state: [{ data: 'fiber:1', id: 'nodeId', label: 'hooks' }]
            }
        ]);
        expect(edits).toEqual([
            { handled: ['hooks', 0, 'value'] },
            {
                inspectorId: 'fiber-tree',
                nodeId: 'fiber:1',
                path: ['hooks', 0, 'value'],
                type: undefined,
                value: { value: 'fiber:2' }
            }
        ]);
    });

    it('selects inspector nodes and emits timeline updates', () => {
        const context = createDevToolsContext();
        const selectedNodes: unknown[] = [];
        const layers: unknown[] = [];
        const events: unknown[] = [];
        let api: DevToolsPluginAPI | null = null;

        context.hooks.hook(
            ReactDevToolsContextHookKeys.CUSTOM_INSPECTOR_SELECT_NODE,
            (payload) => {
                selectedNodes.push(payload);
            }
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.TIMELINE_LAYER_ADDED,
            (payload) => {
                layers.push(payload);
            }
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.TIMELINE_EVENT_ADDED,
            (payload) => {
                events.push(payload);
            }
        );
        registerDevToolsPluginContext({ context });
        setupDevToolsPlugin(
            { id: 'timeline', label: 'Timeline' },
            (pluginApi) => {
                api = pluginApi as unknown as DevToolsPluginAPI;
            }
        );

        api!.selectInspectorNode('fiber-tree', 'fiber:1');
        api!.addTimelineLayer({
            color: '#61dafb',
            id: 'react',
            label: 'React'
        });
        api!.addTimelineEvent({
            data: { count: 1 },
            layerId: 'react',
            title: 'Render'
        });

        expect(selectedNodes).toHaveLength(1);
        expect(layers).toHaveLength(1);
        expect(events).toHaveLength(1);
        expect(api!.now()).toEqual(expect.any(Number));
    });

    it('returns settings defaults and persists updates', () => {
        const context = createDevToolsContext();
        const storage = createMemoryStorage();
        let api: DevToolsPluginAPI | null = null;

        registerDevToolsPluginContext({ context, storage });
        setupDevToolsPlugin(
            {
                id: 'settings',
                label: 'Settings',
                settings: {
                    enabled: {
                        defaultValue: true,
                        label: 'Enabled',
                        type: 'boolean'
                    },
                    limit: { defaultValue: 25, label: 'Limit', type: 'number' },
                    mode: {
                        defaultValue: 'compact',
                        label: 'Mode',
                        options: [{ label: 'Compact', value: 'compact' }],
                        type: 'choice'
                    }
                }
            },
            (pluginApi) => {
                api = pluginApi as unknown as DevToolsPluginAPI;
            }
        );

        expect(api!.getSettings()).toEqual({
            enabled: true,
            limit: 25,
            mode: 'compact'
        });

        api!.setSettings({ enabled: false, limit: 50, mode: 'compact' });

        expect(
            JSON.parse(storage.getItem(getPluginSettingsKey('settings'))!)
        ).toEqual({
            enabled: false,
            limit: 50,
            mode: 'compact'
        });
        expect(api!.getSettings()).toEqual({
            enabled: false,
            limit: 50,
            mode: 'compact'
        });
    });

    it('falls back safely when no inspector handler is registered', async () => {
        const context = createDevToolsContext();
        let api: DevToolsPluginAPI | null = null;

        registerDevToolsPluginContext({ context });
        setupDevToolsPlugin({ id: 'empty', label: 'Empty' }, (pluginApi) => {
            api = pluginApi as unknown as DevToolsPluginAPI;
        });

        await expect(api!.sendInspectorTree('missing')).resolves.toEqual({
            inspectorId: 'missing',
            rootNodes: []
        });
        await expect(
            api!.sendInspectorState('missing', 'node')
        ).resolves.toEqual({
            inspectorId: 'missing',
            nodeId: 'node',
            state: {}
        });
    });
});

function createMemoryStorage(): PluginSettingsStorage {
    const values = new Map<string, string>();

    return {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        }
    };
}
