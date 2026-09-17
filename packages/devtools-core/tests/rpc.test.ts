import {
    createDevToolsCoreClient,
    createDevToolsCoreServer,
    createDevToolsCoreServerFunctions,
    createDevToolsCoreStateStore,
    createPresetCoreClient,
    createPresetCoreServer,
    type RpcChannel
} from '../src/index.js';

describe('devtools-core RPC facade', () => {
    it('round-trips handshake and state updates over a mocked RPC session', async () => {
        const [clientChannel, serverChannel] = createLinkedChannels();
        const store = createDevToolsCoreStateStore();

        createDevToolsCoreServer({
            channel: serverChannel,
            serverId: 'core-test-server',
            store
        });
        const client = createDevToolsCoreClient({ channel: clientChannel });

        const handshake = await client.handshake({ clientId: 'client' });
        await client.updateRenderers([
            {
                capabilities: {
                    hasFiberRoots: true,
                    hasRendererInterface: true,
                    supportsProfiling: true
                },
                detectedAt: 100,
                id: 1,
                name: 'react-dom',
                packageName: 'react-dom',
                targetId: 'top',
                version: '19.1.1'
            }
        ]);
        await client.updateRoots([
            { id: 'root:1', label: 'Root 1', rendererId: 1 }
        ]);
        await client.recordFiberRootEvent({
            id: 'root-event:1',
            lifecycle: 'committed',
            rendererId: 1,
            rootId: 'root:1',
            source: 'onCommitFiberRoot',
            targetId: 'top',
            timestamp: 110
        });
        await client.reportDetectionDiagnostic({
            code: 'react-internals-unavailable',
            id: 'diagnostic:1',
            message: 'React internals are unavailable for this renderer.',
            rendererId: 1,
            severity: 'warning',
            targetId: 'top',
            timestamp: 120
        });
        await client.updateState({
            assets: [{ id: 'asset:1', path: '/logo.svg', type: 'image' }],
            graph: [{ id: 'module:1', imports: ['module:2'] }],
            routes: [{ id: 'route:home', path: '/' }]
        });
        await client.registerCustomInspector({
            id: 'inspector',
            label: 'Inspector',
            state: {
                details: [{ key: 'status', value: 'ready' }]
            },
            tree: [{ id: 'node:1', label: 'Node 1' }]
        });
        await client.addTimelineLayer({ id: 'react', label: 'React' });
        await client.addTimelineEvent({
            layerId: 'react',
            title: 'Commit'
        });

        const roots = await client.getRoots();
        const renderers = await client.getRenderers();
        const diagnostics = await client.getDetectionDiagnostics({
            severity: 'warning',
            targetId: 'top'
        });
        await client.updatePerformanceSettings({
            commitDebounceMs: 75,
            maxNodeCount: 10,
            maxTreeDepth: 4
        });
        await client.setHighPerformanceMode(true);
        const firstRefresh = await client.requestTreeRefresh({
            reason: 'commit',
            requestedAt: 200
        });
        const throttledRefresh = await client.requestTreeRefresh({
            reason: 'commit',
            requestedAt: 225
        });
        const performance = await client.getPerformanceState();
        await client.setInspectMode(true);
        await client.updateInspectHover({
            componentId: 'component:1',
            displayName: 'App',
            rootId: 'root:1',
            source: {
                columnNumber: 10,
                fileName: '/src/App.tsx',
                lineNumber: 2
            }
        });
        const inspectMode = await client.getInspectMode();
        await client.selectInspectTarget({
            componentId: 'component:1',
            rootId: 'root:1'
        });
        await client.toggleInspectMode();
        const assets = await client.getAssets({ type: 'image' });
        const graph = await client.getGraph();
        const routes = await client.getRoutes();
        const tree = await client.sendInspectorTree({
            inspectorId: 'inspector'
        });
        const state = await client.sendInspectorState({
            inspectorId: 'inspector',
            nodeId: 'node:1'
        });

        expect(handshake).toMatchObject({
            serverId: 'core-test-server',
            state: { transportStatus: 'connected' }
        });
        expect(roots.roots).toEqual([
            expect.objectContaining({
                commitCount: 1,
                id: 'root:1',
                label: 'Root 1',
                lifecycle: 'committed',
                rendererId: 1,
                targetId: 'top',
                updatedAt: 110
            })
        ]);
        expect(renderers.renderers).toEqual([
            expect.objectContaining({
                id: 1,
                packageName: 'react-dom',
                targetId: 'top'
            })
        ]);
        expect(diagnostics.diagnostics).toEqual([
            expect.objectContaining({
                code: 'react-internals-unavailable',
                severity: 'warning',
                targetId: 'top'
            })
        ]);
        expect(firstRefresh).toEqual({ allowed: true });
        expect(throttledRefresh).toMatchObject({
            allowed: false,
            diagnostic: { code: 'refresh-throttled' },
            nextAllowedAt: 275
        });
        expect(performance.performance).toMatchObject({
            flags: {
                lastTreeRefreshAt: 200,
                treeRefreshPaused: true
            },
            settings: {
                commitDebounceMs: 75,
                enabled: true,
                maxNodeCount: 10,
                maxTreeDepth: 4
            }
        });
        expect(inspectMode.inspectMode).toMatchObject({
            enabled: true,
            hoveredTarget: {
                componentId: 'component:1',
                displayName: 'App',
                rootId: 'root:1'
            }
        });
        expect(assets.assets).toEqual([
            { id: 'asset:1', path: '/logo.svg', type: 'image' }
        ]);
        expect(graph.graph).toEqual([
            { id: 'module:1', imports: ['module:2'] }
        ]);
        expect(routes.routes).toEqual([{ id: 'route:home', path: '/' }]);
        expect(tree.rootNodes).toEqual([{ id: 'node:1', label: 'Node 1' }]);
        expect(state.state).toEqual({
            details: [{ key: 'status', value: 'ready' }]
        });
        expect(store.getState()).toMatchObject({
            timelineEvents: [{ layerId: 'react', title: 'Commit' }],
            timelineLayers: [{ id: 'react', label: 'React' }],
            inspectMode: {
                enabled: true,
                lastSelectedTarget: {
                    componentId: 'component:1',
                    rootId: 'root:1'
                }
            },
            selectedComponentId: 'component:1',
            selectedRootId: 'root:1'
        });
    });

    it('exposes direct server helpers for roots, components, selections, and inspector filters', () => {
        const store = createDevToolsCoreStateStore({
            ...createDevToolsCoreStateStore().getState(),
            assets: [
                { id: 'image', path: '/image.png', type: 'image' },
                { id: 'style', path: '/style.css', type: 'style' }
            ],
            componentState: {
                'component:1': {
                    componentId: 'component:1',
                    rootId: 'root:1',
                    sections: [
                        { fields: [{ name: 'count', value: 1 }], name: 'state' }
                    ]
                }
            },
            components: [
                { displayName: 'App', id: 'component:1', rootId: 'root:1' },
                { displayName: 'Footer', id: 'component:2', rootId: 'root:2' }
            ],
            roots: [
                { id: 'root:1', rendererId: 1 },
                { id: 'root:2', rendererId: 2 }
            ]
        });
        const server = createDevToolsCoreServerFunctions(store);

        expect(server.getAssets()).toEqual({
            assets: [
                { id: 'image', path: '/image.png', type: 'image' },
                { id: 'style', path: '/style.css', type: 'style' }
            ]
        });
        expect(server.getComponents({ rootId: 'root:1' })).toEqual({
            components: [
                { displayName: 'App', id: 'component:1', rootId: 'root:1' }
            ]
        });
        expect(
            server.getComponentState({
                componentId: 'component:1',
                rootId: 'root:1'
            })
        ).toEqual({
            componentId: 'component:1',
            rootId: 'root:1',
            sections: [{ fields: [{ name: 'count', value: 1 }], name: 'state' }]
        });
        expect(server.getRoots({ rendererId: 2 })).toEqual({
            roots: [{ id: 'root:2', rendererId: 2 }]
        });

        server.highlightComponent({
            componentId: 'component:2',
            rootId: 'root:2'
        });
        server.selectRoot('root:2');
        server.selectComponent('component:2');
        server.registerCustomTab({ name: 'timeline', title: 'Timeline' });
        server.registerCustomCommand({ id: 'reload', label: 'Reload' });
        server.removeCustomCommand('reload');
        server.registerCustomInspector({
            id: 'components',
            label: 'Components',
            tree: [
                { id: 'app', label: 'App' },
                { id: 'footer', label: 'Footer' }
            ]
        });

        expect(
            server.sendInspectorTree({
                filter: 'app',
                inspectorId: 'components'
            })
        ).toEqual({
            inspectorId: 'components',
            rootNodes: [{ id: 'app', label: 'App' }]
        });
        expect(
            server.sendInspectorState({
                inspectorId: 'missing',
                nodeId: 'missing-node'
            })
        ).toEqual({
            inspectorId: 'missing',
            nodeId: 'missing-node',
            state: {}
        });
        expect(server.getState()).toMatchObject({
            commands: [],
            customTabs: [{ name: 'timeline', title: 'Timeline' }],
            highlightedComponentId: 'component:2',
            selectedComponentId: 'component:2',
            selectedRootId: 'root:2'
        });
    });

    it('creates default preset facades and server-owned stores', async () => {
        const [clientChannel, serverChannel] = createLinkedChannels();

        createDevToolsCoreServer({ channel: serverChannel });
        const client = createDevToolsCoreClient({ channel: clientChannel });

        await expect(
            client.handshake({ clientId: 'default-client' })
        ).resolves.toMatchObject({
            serverId: 'react-devtools-core',
            state: { transportStatus: 'connected' }
        });

        expect(createPresetCoreClient()).toBeDefined();
        expect(createPresetCoreServer()).toBeDefined();
    });
});

function createLinkedChannels(): [RpcChannel, RpcChannel] {
    const leftListeners = new Set<(data: unknown) => void>();
    const rightListeners = new Set<(data: unknown) => void>();

    return [
        {
            off(listener) {
                leftListeners.delete(listener);
            },
            on(listener) {
                leftListeners.add(listener);
            },
            post(data) {
                for (const listener of rightListeners) {
                    listener(data);
                }
            }
        },
        {
            off(listener) {
                rightListeners.delete(listener);
            },
            on(listener) {
                rightListeners.add(listener);
            },
            post(data) {
                for (const listener of leftListeners) {
                    listener(data);
                }
            }
        }
    ];
}
