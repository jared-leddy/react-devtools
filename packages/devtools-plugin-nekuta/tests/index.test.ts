import { setupDevToolsPlugin } from '@devtools/api';
import {
    createNekuta,
    defineStore,
    disposeNekuta,
    NekutaStore,
    useStore
} from '@nekuta/core';
import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import {
    NEKUTA_INSPECTOR_ID,
    NEKUTA_PLUGIN_ID,
    NEKUTA_TIMELINE_LAYER_ID,
    registerNekutaDevTools
} from '../src/index.js';
import type {
    EditInspectorStateRequest,
    InspectorStateRequest,
    InspectorTreeRequest,
    PluginSetupContext
} from '@devtools/api';

type NekutaApiMock = PluginSetupContext & {
    on: PluginSetupContext['on'] & {
        editInspectorState: jest.Mock<
            void,
            [
                string,
                (payload: EditInspectorStateRequest) => Promise<void> | void
            ]
        >;
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

    it('registers the Nekuta DevTools inspector handlers', () => {
        const api = createApiMock();

        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        expect(() => registerNekutaDevTools()).not.toThrow();
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
        expect(api.on.editInspectorState).toHaveBeenCalledWith(
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

    it('reads real Nekuta stores and writes edits through the inspector contract', () => {
        const nekuta = createNekuta();
        const useCounterStore = defineStore({
            actions: {
                increment() {
                    this.count += 1;
                }
            },
            getters: {
                double(state) {
                    return state.count * 2;
                }
            },
            id: 'counter',
            state: () => ({
                count: 1,
                label: 'Counter'
            })
        });
        const store = useCounterStore(nekuta);
        const api = createApiMock();
        const treeHandlers = new Map<
            string,
            (payload: InspectorTreeRequest) => unknown
        >();
        const stateHandlers = new Map<
            string,
            (payload: InspectorStateRequest) => unknown
        >();
        const editHandlers = new Map<
            string,
            (payload: EditInspectorStateRequest) => Promise<void> | void
        >();

        api.on.getInspectorTree.mockImplementation((inspectorId, handler) => {
            treeHandlers.set(inspectorId, handler);
        });
        api.on.getInspectorState.mockImplementation((inspectorId, handler) => {
            stateHandlers.set(inspectorId, handler);
        });
        api.on.editInspectorState.mockImplementation((inspectorId, handler) => {
            editHandlers.set(inspectorId, handler);
        });
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        function CounterView() {
            const counter = useStore(useCounterStore);

            return createElement('output', {}, counter.count);
        }

        render(
            createElement(NekutaStore, { nekuta }, createElement(CounterView))
        );
        registerNekutaDevTools({ nekuta });

        expect(
            treeHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID
            })
        ).toEqual([
            {
                id: 'counter',
                label: 'counter',
                metadata: {
                    actionCount: 1,
                    stateKeys: ['count', 'label']
                },
                tags: [{ label: 'store' }]
            }
        ]);
        expect(
            stateHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'counter'
            })
        ).toEqual({
            inspectorId: NEKUTA_INSPECTOR_ID,
            nodeId: 'counter',
            state: {
                actions: [
                    {
                        editable: false,
                        key: 'increment',
                        value: {
                            _custom: {
                                display: 'ƒ anonymous()',
                                readOnly: true,
                                type: 'function'
                            }
                        }
                    }
                ],
                getters: [
                    {
                        editable: false,
                        key: 'double',
                        value: 2
                    }
                ],
                metadata: [
                    { key: 'id', value: 'counter' },
                    { key: 'stateKeys', value: 2 },
                    { key: 'getterKeys', value: 1 },
                    { key: 'actionKeys', value: 1 }
                ],
                state: [
                    {
                        editable: true,
                        key: 'count',
                        value: 1
                    },
                    {
                        editable: true,
                        key: 'label',
                        value: 'Counter'
                    }
                ]
            }
        });

        act(() => {
            editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'counter',
                path: ['state', 0, 'value'],
                state: {
                    value: 7
                }
            });
        });

        expect(store.count).toBe(7);
        expect(screen.getByText('7')).toBeTruthy();
        expect(
            stateHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'counter'
            })
        ).toEqual(
            expect.objectContaining({
                state: expect.objectContaining({
                    getters: [
                        {
                            editable: false,
                            key: 'double',
                            value: 14
                        }
                    ],
                    state: [
                        {
                            editable: true,
                            key: 'count',
                            value: 7
                        },
                        {
                            editable: true,
                            key: 'label',
                            value: 'Counter'
                        }
                    ]
                })
            })
        );
        expect(api.setInspectorState).toHaveBeenCalledWith(
            NEKUTA_INSPECTOR_ID,
            'counter',
            expect.objectContaining({
                state: [
                    {
                        editable: true,
                        key: 'count',
                        value: 7
                    },
                    {
                        editable: true,
                        key: 'label',
                        value: 'Counter'
                    }
                ]
            })
        );
        expect(api.addTimelineEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                layerId: NEKUTA_TIMELINE_LAYER_ID,
                subtitle: 'counter',
                title: 'State edited'
            })
        );

        disposeNekuta(nekuta);
    });

    it('returns diagnostic state and rejects unsupported edits', () => {
        const api = createApiMock();
        const stateHandlers = new Map<
            string,
            (payload: InspectorStateRequest) => unknown
        >();
        const editHandlers = new Map<
            string,
            (payload: EditInspectorStateRequest) => Promise<void> | void
        >();

        api.on.getInspectorState.mockImplementation((inspectorId, handler) => {
            stateHandlers.set(inspectorId, handler);
        });
        api.on.editInspectorState.mockImplementation((inspectorId, handler) => {
            editHandlers.set(inspectorId, handler);
        });
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        registerNekutaDevTools();

        expect(
            stateHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'missing'
            })
        ).toEqual({
            inspectorId: NEKUTA_INSPECTOR_ID,
            nodeId: 'missing',
            state: {
                error: [
                    {
                        key: 'message',
                        value: 'Unknown Nekuta store: missing'
                    }
                ]
            }
        });
        expect(() =>
            editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'missing',
                path: ['state', 0, 'value'],
                state: {
                    value: 1
                }
            })
        ).toThrow('Unknown Nekuta store: missing');
    });

    it('supports rename and remove edit operations against Nekuta state', () => {
        const nekuta = createNekuta();
        const useProfileStore = defineStore({
            id: 'profile',
            state: () => ({
                name: 'Ada',
                role: 'admin'
            })
        });
        const store = useProfileStore(nekuta);
        const api = createApiMock();
        const editHandlers = new Map<
            string,
            (payload: EditInspectorStateRequest) => Promise<void> | void
        >();

        api.on.editInspectorState.mockImplementation((inspectorId, handler) => {
            editHandlers.set(inspectorId, handler);
        });
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        registerNekutaDevTools({ nekuta });

        editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
            inspectorId: NEKUTA_INSPECTOR_ID,
            nodeId: 'profile',
            path: ['state', 0, 'value'],
            state: {
                newKey: 'displayName',
                value: 'Ada Lovelace'
            }
        });
        editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
            inspectorId: NEKUTA_INSPECTOR_ID,
            nodeId: 'profile',
            path: ['state', 0, 'value'],
            state: {
                remove: true
            }
        });

        expect(store.$state).toEqual({
            displayName: 'Ada Lovelace'
        });
        expect(api.addTimelineEvent).toHaveBeenLastCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    operation: 'remove'
                })
            })
        );

        disposeNekuta(nekuta);
    });

    it('rejects unsupported edit paths and unknown state indexes', () => {
        const nekuta = createNekuta();
        const useSettingsStore = defineStore({
            id: 'settings',
            state: () => ({
                theme: 'dark'
            })
        });
        useSettingsStore(nekuta);
        const api = createApiMock();
        const editHandlers = new Map<
            string,
            (payload: EditInspectorStateRequest) => Promise<void> | void
        >();

        api.on.editInspectorState.mockImplementation((inspectorId, handler) => {
            editHandlers.set(inspectorId, handler);
        });
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                setup(api);
            }
        );

        registerNekutaDevTools({ nekuta });

        expect(() =>
            editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'settings',
                path: ['getters', 0, 'value'],
                state: {
                    value: 'light'
                }
            })
        ).toThrow('Unsupported Nekuta edit path: getters.0.value');
        expect(() =>
            editHandlers.get(NEKUTA_INSPECTOR_ID)?.({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId: 'settings',
                path: ['state', 9, 'value'],
                state: {
                    value: 'light'
                }
            })
        ).toThrow('Unknown Nekuta state entry index: 9');

        disposeNekuta(nekuta);
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
