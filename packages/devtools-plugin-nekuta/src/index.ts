import { setupDevToolsPlugin } from '@devtools/api';
import { formatDisplayableValue } from '@devtools/core/value-format';
import { getActiveNekuta } from '@nekuta/core';
import type {
    EditInspectorStateRequest,
    InspectorStateResponse,
    PluginSetupContext
} from '@devtools/api';
import type { NekutaInstance, StoreGeneric } from '@nekuta/core';

export const NEKUTA_PLUGIN_ID = 'nekuta';
export const NEKUTA_INSPECTOR_ID = 'nekuta-stores';
export const NEKUTA_TIMELINE_LAYER_ID = 'nekuta-actions';

export interface NekutaDevToolsOptions {
    id?: string;
    label?: string;
    nekuta?: NekutaInstance;
}

export function registerNekutaDevTools(
    options: NekutaDevToolsOptions = {}
): void {
    setupDevToolsPlugin(
        {
            id: options.id ?? NEKUTA_PLUGIN_ID,
            label: options.label ?? 'Nekuta',
            packageName: '@devtools/nekuta-plugin'
        },
        (api) => {
            api.addInspector({
                id: NEKUTA_INSPECTOR_ID,
                label: 'Nekuta Stores',
                noSelectionText: 'Select a Nekuta store to inspect its state.',
                stateFilterPlaceholder: 'Filter state',
                treeFilterPlaceholder: 'Filter stores'
            });

            api.addTimelineLayer({
                color: 0x16a34a,
                id: NEKUTA_TIMELINE_LAYER_ID,
                label: 'Nekuta actions'
            });

            api.on.getInspectorTree(NEKUTA_INSPECTOR_ID, ({ filter }) => {
                const normalizedFilter = filter?.toLowerCase();

                return getNekutaStores(options.nekuta)
                    .filter(
                        (store) =>
                            !normalizedFilter ||
                            store.$id.toLowerCase().includes(normalizedFilter)
                    )
                    .map((store) => ({
                        id: store.$id,
                        label: store.$id,
                        metadata: createStoreMetadata(store),
                        tags: [
                            {
                                label: 'store'
                            }
                        ]
                    }));
            });
            api.on.getInspectorState(NEKUTA_INSPECTOR_ID, ({ nodeId }) => ({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId,
                state: getStoreInspectorState(nodeId, options.nekuta)
            }));
            api.on.editInspectorState(NEKUTA_INSPECTOR_ID, (payload) => {
                editStoreInspectorState(api, payload, options.nekuta);
            });
        }
    );
}

function getNekutaStores(nekuta?: NekutaInstance): StoreGeneric[] {
    return Array.from((nekuta ?? getActiveNekuta())?._s.values() ?? []);
}

function getNekutaStore(
    nodeId: string,
    nekuta?: NekutaInstance
): StoreGeneric | undefined {
    return (nekuta ?? getActiveNekuta())?._s.get(nodeId);
}

function getStoreInspectorState(
    nodeId: string,
    nekuta?: NekutaInstance
): InspectorStateResponse['state'] {
    const store = getNekutaStore(nodeId, nekuta);

    if (!store) {
        return {
            error: [
                {
                    key: 'message',
                    value: `Unknown Nekuta store: ${nodeId}`
                }
            ]
        };
    }

    const stateEntries = Object.entries(store.$state).map(([key, value]) => ({
        editable: true,
        key,
        value: formatDisplayableValue(value)
    }));
    const getterEntries = getGetterEntries(store);
    const actionEntries = getActionEntries(store);

    return {
        ...(stateEntries.length > 0 ? { state: stateEntries } : {}),
        ...(getterEntries.length > 0 ? { getters: getterEntries } : {}),
        ...(actionEntries.length > 0 ? { actions: actionEntries } : {}),
        metadata: [
            { key: 'id', value: store.$id },
            { key: 'stateKeys', value: Object.keys(store.$state).length },
            { key: 'getterKeys', value: getterEntries.length },
            { key: 'actionKeys', value: actionEntries.length }
        ]
    };
}

function editStoreInspectorState(
    api: PluginSetupContext,
    payload: EditInspectorStateRequest,
    nekuta?: NekutaInstance
): void {
    const store = getNekutaStore(payload.nodeId, nekuta);

    if (!store) {
        throw new Error(`Unknown Nekuta store: ${payload.nodeId}`);
    }

    const [group, index, field] = payload.path;

    if (group !== 'state' || field !== 'value' || typeof index !== 'number') {
        throw new Error(
            `Unsupported Nekuta edit path: ${payload.path.join('.')}`
        );
    }

    const key = Object.keys(store.$state)[index];

    if (!key) {
        throw new Error(`Unknown Nekuta state entry index: ${index}`);
    }

    if (payload.state.remove) {
        store.$patch((state) => {
            delete state[key];
        });
    } else if (payload.state.newKey) {
        store.$patch((state) => {
            state[payload.state.newKey as string] = payload.state.value;
            delete state[key];
        });
    } else {
        store.$patch({
            [key]: payload.state.value
        });
    }

    api.setInspectorState(
        NEKUTA_INSPECTOR_ID,
        payload.nodeId,
        getStoreInspectorState(payload.nodeId, nekuta)
    );
    api.addTimelineEvent({
        data: {
            key,
            operation: payload.state.remove
                ? 'remove'
                : payload.state.newKey
                  ? 'rename'
                  : 'set',
            path: payload.path,
            value: payload.state.value
        },
        layerId: NEKUTA_TIMELINE_LAYER_ID,
        subtitle: payload.nodeId,
        time: api.now(),
        title: 'State edited'
    });
}

function createStoreMetadata(store: StoreGeneric): Record<string, unknown> {
    return {
        actionCount: getActionEntries(store).length,
        stateKeys: Object.keys(store.$state)
    };
}

function getGetterEntries(store: StoreGeneric) {
    return getInspectableStoreKeys(store)
        .filter(
            (key) =>
                !(key in store.$state) &&
                typeof store[key] !== 'function' &&
                !key.startsWith('$')
        )
        .map((key) => ({
            editable: false,
            key,
            value: formatDisplayableValue(store[key])
        }));
}

function getActionEntries(store: StoreGeneric) {
    return getInspectableStoreKeys(store)
        .filter(
            (key) => typeof store[key] === 'function' && !key.startsWith('$')
        )
        .map((key) => ({
            editable: false,
            key,
            value: formatDisplayableValue(store[key])
        }));
}

function getInspectableStoreKeys(store: StoreGeneric): string[] {
    return Array.from(
        new Set([
            ...Object.keys(store),
            ...Object.keys(Object.getPrototypeOf(store) ?? {})
        ])
    ).sort();
}
