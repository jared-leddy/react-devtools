import { setupDevToolsPlugin } from '@devtools/api';
import {
    NEKUTA_INSPECTOR_ID,
    NEKUTA_PLUGIN_ID,
    NEKUTA_TIMELINE_LAYER_ID,
    registerNekutaDevTools
} from '../src/index.js';
import type {
    InspectorStateRequest,
    InspectorTreeRequest,
    PluginSetupContext
} from '@devtools/api';

interface NekutaStoreFixture {
    getState(): Record<string, unknown>;
    id: string;
}

type NekutaApiMock = PluginSetupContext & {
    on: PluginSetupContext['on'] & {
        getInspectorState: jest.Mock<
            void,
            [
                string,
                (payload: InspectorStateRequest) => Promise<unknown> | unknown
            ]
        >;
        getInspectorTree: jest.Mock<
            void,
            [
                string,
                (payload: InspectorTreeRequest) => Promise<unknown> | unknown
            ]
        >;
    };
};

describe('@devtools/nekuta-plugin', () => {
    beforeEach(() => {
        jest.mocked(setupDevToolsPlugin).mockReset();
    });

    it('registers the Nekuta DevTools inspector without throwing near a store fixture', () => {
        const store: NekutaStoreFixture = {
            getState: () => ({ count: 1 }),
            id: 'counter'
        };
        const api = createApiMock();

        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        expect(() => registerNekutaDevTools()).not.toThrow();
        expect(store.getState()).toEqual({ count: 1 });
        expect(setupDevToolsPlugin).toHaveBeenCalledWith(
            {
                id: NEKUTA_PLUGIN_ID,
                label: 'Nekuta',
                packageName: '@devtools/nekuta-plugin'
            },
            expect.any(Function)
        );
        expect(api.addInspector).toHaveBeenCalledWith({
            id: NEKUTA_INSPECTOR_ID,
            label: 'Nekuta Stores',
            noSelectionText: 'Select a Nekuta store to inspect its state.',
            stateFilterPlaceholder: 'Filter state',
            treeFilterPlaceholder: 'Filter stores'
        });
        expect(api.addTimelineLayer).toHaveBeenCalledWith({
            color: 0x16a34a,
            id: NEKUTA_TIMELINE_LAYER_ID,
            label: 'Nekuta actions'
        });
        expect(api.on.getInspectorTree).toHaveBeenCalledWith(
            NEKUTA_INSPECTOR_ID,
            expect.any(Function)
        );
        expect(api.on.getInspectorState).toHaveBeenCalledWith(
            NEKUTA_INSPECTOR_ID,
            expect.any(Function)
        );
    });

    it('allows descriptor overrides for embedded Nekuta integrations', () => {
        registerNekutaDevTools({
            id: 'custom-nekuta',
            label: 'Custom Nekuta'
        });

        expect(setupDevToolsPlugin).toHaveBeenCalledWith(
            {
                id: 'custom-nekuta',
                label: 'Custom Nekuta',
                packageName: '@devtools/nekuta-plugin'
            },
            expect.any(Function)
        );
    });

    it('returns empty tree and diagnostic state from the scaffold handlers', () => {
        const api = createApiMock();
        const treeHandlers = new Map<
            string,
            (payload: InspectorTreeRequest) => unknown
        >();
        const stateHandlers = new Map<
            string,
            (payload: InspectorStateRequest) => unknown
        >();

        api.on.getInspectorTree.mockImplementation((inspectorId, handler) => {
            treeHandlers.set(inspectorId, handler);
        });
        api.on.getInspectorState.mockImplementation((inspectorId, handler) => {
            stateHandlers.set(inspectorId, handler);
        });
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        registerNekutaDevTools();

        expect(
            treeHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID
            })
        ).toEqual([]);
        expect(
            stateHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'counter'
            })
        ).toEqual({
            inspectorId: NEKUTA_INSPECTOR_ID,
            nodeId: 'counter',
            state: {
                metadata: [
                    {
                        key: 'status',
                        value: 'Nekuta adapter registered'
                    }
                ]
            }
        });
    });
});

function createApiMock(): NekutaApiMock {
    return {
        addTimelineEvent: jest.fn(),
        addInspector: jest.fn(),
        addTimelineLayer: jest.fn(),
        descriptor: {
            id: NEKUTA_PLUGIN_ID,
            label: 'Nekuta'
        },
        editInspectorState: jest.fn(),
        getSettings: jest.fn(() => ({})),
        now: jest.fn(() => 0),
        notify: jest.fn(),
        on: {
            editInspectorState: jest.fn(),
            getInspectorState: jest.fn(),
            getInspectorTree: jest.fn()
        },
        registerInspector: jest.fn(),
        registerRouterAdapter: jest.fn(),
        selectInspectorNode: jest.fn(),
        sendInspectorState: jest.fn(),
        sendInspectorTree: jest.fn(),
        setInspectorState: jest.fn(),
        setSettings: jest.fn()
    };
}
