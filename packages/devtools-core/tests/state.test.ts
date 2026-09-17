import {
    createDevToolsCoreStateStore,
    createInitialDevToolsCoreState
} from '../src/index.js';

describe('devtools-core state store', () => {
    it('tracks roots, selections, inspectors, tabs, commands, timeline, settings, and transport status', () => {
        const store = createDevToolsCoreStateStore();
        const listener = jest.fn();
        const unsubscribe = store.subscribe(listener);

        store.setRenderers([{ id: 1, name: 'react-dom', version: '19.1.1' }]);
        store.setRoots([{ id: 'root:1', label: 'Root', rendererId: 1 }]);
        store.setComponents([
            {
                displayName: 'App',
                id: 'fiber:1',
                rootId: 'root:1',
                type: 'function'
            }
        ]);
        store.selectRoot('root:1');
        store.selectComponent('fiber:1');
        store.registerCustomInspector({
            id: 'inspector',
            label: 'Inspector',
            tree: [{ id: 'node', label: 'Node' }]
        });
        store.registerCustomTab({ name: 'routes', title: 'Routes' });
        store.registerCustomCommand({ id: 'open', label: 'Open' });
        store.addTimelineLayer({ id: 'react', label: 'React' });
        store.addTimelineEvent({ layerId: 'react', title: 'Render' });
        store.setSettings({ theme: 'dark' });
        store.setTransportStatus('connected');

        expect(store.getState()).toMatchObject({
            commands: [{ id: 'open', label: 'Open' }],
            customInspectors: [{ id: 'inspector', label: 'Inspector' }],
            customTabs: [{ name: 'routes', title: 'Routes' }],
            selectedComponentId: 'fiber:1',
            selectedRootId: 'root:1',
            settings: { theme: 'dark' },
            timelineEvents: [{ layerId: 'react', title: 'Render' }],
            timelineLayers: [{ id: 'react', label: 'React' }],
            transportStatus: 'connected'
        });
        expect(listener).toHaveBeenCalled();

        unsubscribe();
        store.setTransportStatus('disconnected');
        expect(listener).not.toHaveBeenLastCalledWith(
            expect.objectContaining({ transportStatus: 'disconnected' }),
            expect.anything()
        );
    });

    it('creates isolated initial state snapshots', () => {
        const first = createInitialDevToolsCoreState();
        const second = createInitialDevToolsCoreState();

        first.roots.push({ id: 'root' });

        expect(second.roots).toEqual([]);
    });

    it('replaces snapshots and upserts existing records without mutating inputs', () => {
        const initialState = createInitialDevToolsCoreState();
        initialState.commands = [{ id: 'refresh', label: 'Refresh' }];
        initialState.customTabs = [{ name: 'routes', title: 'Routes' }];
        initialState.timelineLayers = [{ id: 'react', label: 'React' }];

        const store = createDevToolsCoreStateStore(initialState);

        store.registerCustomCommand({ id: 'refresh', label: 'Refresh tree' });
        store.registerCustomTab({ name: 'routes', title: 'Router' });
        store.addTimelineLayer({ id: 'react', label: 'React commits' });
        store.setAssets([{ id: 'logo', path: '/logo.svg', type: 'image' }]);
        store.setComponentState({
            componentId: 'component:1',
            rootId: 'root:1',
            sections: [
                { fields: [{ name: 'name', value: 'App' }], name: 'state' }
            ]
        });
        store.setGraph([{ id: 'module:1', imports: [] }]);
        store.setRoutes([{ id: 'home', path: '/' }]);

        expect(initialState.commands).toEqual([
            { id: 'refresh', label: 'Refresh' }
        ]);
        expect(store.getState()).toMatchObject({
            assets: [{ id: 'logo', path: '/logo.svg', type: 'image' }],
            commands: [{ id: 'refresh', label: 'Refresh tree' }],
            componentState: {
                'component:1': {
                    componentId: 'component:1',
                    rootId: 'root:1',
                    sections: [
                        {
                            fields: [{ name: 'name', value: 'App' }],
                            name: 'state'
                        }
                    ]
                }
            },
            customTabs: [{ name: 'routes', title: 'Router' }],
            graph: [{ id: 'module:1', imports: [] }],
            routes: [{ id: 'home', path: '/' }],
            timelineLayers: [{ id: 'react', label: 'React commits' }]
        });

        const replacementState = createInitialDevToolsCoreState();
        replacementState.roots = [{ id: 'replacement-root' }];
        const replaced = store.replaceState(replacementState);

        replacementState.roots.push({ id: 'mutated-after-replace' });

        expect(replaced.roots).toEqual([{ id: 'replacement-root' }]);
        expect(store.getState().roots).toEqual([{ id: 'replacement-root' }]);
    });

    it('tracks renderer detection metadata, root lifecycle events, and diagnostics', () => {
        const store = createDevToolsCoreStateStore();

        store.setRenderers([
            {
                capabilities: {
                    hasFiberRoots: true,
                    hasRendererInterface: true,
                    supportsProfiling: false
                },
                detectedAt: 100,
                id: 7,
                name: 'react-dom',
                packageName: 'react-dom',
                targetId: 'top',
                version: '19.1.1'
            }
        ]);
        store.recordFiberRootEvent({
            id: 'event:1',
            lifecycle: 'added',
            rendererId: 7,
            rootId: 'target:top/renderer:7/root:1',
            source: 'getFiberRoots',
            targetId: 'top',
            timestamp: 110
        });
        store.recordFiberRootEvent({
            didError: false,
            id: 'event:2',
            lifecycle: 'committed',
            rendererId: 7,
            rootId: 'target:top/renderer:7/root:1',
            source: 'onCommitFiberRoot',
            targetId: 'top',
            timestamp: 120
        });
        store.reportDiagnostic({
            code: 'renderer-unsupported',
            id: 'diagnostic:1',
            message: 'React renderer internals are not supported.',
            rendererId: 7,
            severity: 'warning',
            targetId: 'top',
            timestamp: 130
        });
        store.reportDiagnostic({
            code: 'renderer-unsupported',
            id: 'diagnostic:1',
            message: 'React renderer internals are partially supported.',
            rendererId: 7,
            severity: 'info',
            targetId: 'top',
            timestamp: 140
        });

        expect(store.getState()).toMatchObject({
            diagnostics: [
                {
                    id: 'diagnostic:1',
                    message:
                        'React renderer internals are partially supported.',
                    severity: 'info'
                }
            ],
            renderers: [
                {
                    id: 7,
                    packageName: 'react-dom',
                    targetId: 'top'
                }
            ],
            rootEvents: [
                { id: 'event:1', lifecycle: 'added' },
                { id: 'event:2', lifecycle: 'committed' }
            ],
            roots: [
                {
                    commitCount: 1,
                    id: 'target:top/renderer:7/root:1',
                    lifecycle: 'committed',
                    mountedAt: 110,
                    rendererId: 7,
                    targetId: 'top',
                    updatedAt: 120
                }
            ]
        });
    });
});
