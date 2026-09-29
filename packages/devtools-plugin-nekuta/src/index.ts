import { setupDevToolsPlugin } from '@devtools/api';

export const NEKUTA_PLUGIN_ID = 'nekuta';
export const NEKUTA_INSPECTOR_ID = 'nekuta-stores';
export const NEKUTA_TIMELINE_LAYER_ID = 'nekuta-actions';

export interface NekutaDevToolsOptions {
    id?: string;
    label?: string;
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

            api.on.getInspectorTree(NEKUTA_INSPECTOR_ID, () => []);
            api.on.getInspectorState(NEKUTA_INSPECTOR_ID, ({ nodeId }) => ({
                inspectorId: NEKUTA_INSPECTOR_ID,
                nodeId,
                state: {
                    metadata: [
                        {
                            key: 'status',
                            value: 'Nekuta adapter registered'
                        }
                    ]
                }
            }));
        }
    );
}
