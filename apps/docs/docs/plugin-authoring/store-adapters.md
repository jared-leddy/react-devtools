---
title: Store Adapters
---

# Store Adapters and Custom Inspectors

Store adapters translate a state library into the DevTools custom inspector contract. Use this path when a library owns a tree of stores, queries, atoms, modules, resources, or subscriptions and wants DevTools to inspect and optionally edit that state.

## Choose the Right Surface

Use a custom inspector when the integration has a browsable hierarchy and node-specific state. This is the right default for stores, caches, query clients, state machines, feature flags, and domain objects.

Use a custom tab when the integration needs a full application surface: dashboards, flamegraphs, relationship maps, or workflows that are not centered on selecting a tree node.

Use timeline layers when the useful debugging signal is chronological. Store actions, cache misses, network refetches, optimistic updates, rollbacks, and subscription fan-out are timeline events.

These surfaces can be combined. A store library can expose a custom inspector for current state, a timeline layer for writes/actions, and a custom tab later if it needs a richer dashboard.

## Inspector Contract

A store adapter usually registers one inspector:

```ts
import { setupDevToolsPlugin } from '@devtools/api';

setupDevToolsPlugin(
    {
        id: 'example-store',
        label: 'Example Store',
        packageName: '@example/store-devtools'
    },
    (api) => {
        api.addInspector({
            id: 'stores',
            label: 'Stores',
            stateFilterPlaceholder: 'Filter state',
            treeFilterPlaceholder: 'Filter stores'
        });
    }
);
```

The tree handler returns stable nodes. Keep IDs durable across renders and edits, because DevTools uses them to preserve selection and request node state.

```ts
api.on.getInspectorTree('stores', ({ filter }) => {
    return stores
        .filter((store) => !filter || store.name.includes(filter))
        .map((store) => ({
            id: store.id,
            label: store.name,
            metadata: {
                kind: store.kind
            },
            tags: [
                {
                    label: store.kind
                }
            ]
        }));
});
```

The state handler returns grouped entries for the selected node. Values may be serializable primitives, arrays, records, or richer values when the transport can preserve them. Prefer serializable values for extension and iframe delivery modes.

```ts
api.on.getInspectorState('stores', ({ nodeId }) => {
    const store = findStore(nodeId);

    if (!store) {
        return {
            identity: [{ key: 'missing', value: true }]
        };
    }

    return {
        identity: [
            { key: 'id', value: store.id },
            { key: 'name', value: store.name },
            { key: 'kind', value: store.kind }
        ],
        state: Object.entries(store.getState()).map(([key, value]) => ({
            editable: store.canEdit(key),
            key,
            value
        }))
    };
});
```

## Editable State

Editable entries opt into mutation by setting `editable: true`. DevTools sends edit requests with:

- `inspectorId`: the inspector that owns the edit.
- `nodeId`: the selected node.
- `path`: the location inside the inspector state, such as `['state', 0, 'value']`.
- `state.value`: the proposed next value.
- `state.newKey`: an optional rename target.
- `state.remove`: whether the entry should be removed.

Handle edits defensively. Validate the node, path, key, and value before writing. If the library rejects the edit, throw an error or notify the user and leave the store unchanged.

```ts
api.on.editInspectorState('stores', ({ nodeId, path, state }) => {
    const store = findStore(nodeId);

    if (!store) {
        throw new Error(`Unknown store node: ${nodeId}`);
    }

    const [group, index, field] = path;

    if (group !== 'state' || field !== 'value' || typeof index !== 'number') {
        throw new Error(`Unsupported edit path: ${path.join('.')}`);
    }

    const entry = Object.entries(store.getState())[index];

    if (!entry) {
        throw new Error(`Unknown state entry index: ${index}`);
    }

    const [key] = entry;

    if (!store.canEdit(key)) {
        throw new Error(`State key is read-only: ${key}`);
    }

    if (state.remove) {
        store.remove(key);
    } else if (state.newKey) {
        store.rename(key, state.newKey);
    } else {
        store.set(key, state.value);
    }

    api.setInspectorState('stores', nodeId, {
        state: Object.entries(store.getState()).map(([nextKey, value]) => ({
            editable: store.canEdit(nextKey),
            key: nextKey,
            value
        }))
    });
});
```

Use `api.setInspectorState` after a successful edit when the library can synchronously compute the next state. If the write is async, emit a timeline event immediately, then update inspector state when the write settles.

## Error Handling

Adapters should fail closed. A failed read should return a small diagnostic state instead of crashing the plugin:

```ts
api.on.getInspectorState('stores', ({ nodeId }) => {
    try {
        return readStoreState(nodeId);
    } catch (error) {
        return {
            error: [
                {
                    key: 'message',
                    value:
                        error instanceof Error
                            ? error.message
                            : 'Unable to read store state'
                }
            ]
        };
    }
});
```

For edits, prefer explicit validation errors. Do not partially apply an edit and then throw. When an edit may trigger user code, catch library errors and surface them with `api.notify` or a timeline event.

```ts
api.addTimelineLayer({
    id: 'store-edits',
    label: 'Store edits',
    color: 0x4f46e5
});

api.on.editInspectorState('stores', async (payload) => {
    try {
        await applyEdit(payload);
        api.addTimelineEvent({
            layerId: 'store-edits',
            time: api.now(),
            title: 'State edited',
            subtitle: payload.nodeId,
            data: payload
        });
    } catch (error) {
        api.notify(
            error instanceof Error ? error.message : 'Store edit failed'
        );
        throw error;
    }
});
```

## Minimal Adapter Template

Use this shape when starting a third-party state integration:

```ts
import { setupDevToolsPlugin } from '@devtools/api';

export function registerStoreDevTools({
    stores
}: {
    stores: Array<{
        canEdit(key: string): boolean;
        getState(): Record<string, unknown>;
        id: string;
        label: string;
        set(key: string, value: unknown): void;
    }>;
}) {
    const findStore = (id: string) => stores.find((store) => store.id === id);

    setupDevToolsPlugin(
        {
            id: 'store-adapter',
            label: 'Store Adapter',
            packageName: '@example/store-adapter'
        },
        (api) => {
            api.addInspector({
                id: 'stores',
                label: 'Stores',
                stateFilterPlaceholder: 'Filter state',
                treeFilterPlaceholder: 'Filter stores'
            });

            api.on.getInspectorTree('stores', () =>
                stores.map((store) => ({
                    id: store.id,
                    label: store.label
                }))
            );

            api.on.getInspectorState('stores', ({ nodeId }) => {
                const store = findStore(nodeId);

                if (!store) {
                    return { error: [{ key: 'missing', value: nodeId }] };
                }

                return {
                    state: Object.entries(store.getState()).map(
                        ([key, value]) => ({
                            editable: store.canEdit(key),
                            key,
                            value
                        })
                    )
                };
            });

            api.on.editInspectorState('stores', ({ nodeId, path, state }) => {
                const store = findStore(nodeId);
                const [group, index, field] = path;

                if (
                    !store ||
                    group !== 'state' ||
                    field !== 'value' ||
                    typeof index !== 'number'
                ) {
                    throw new Error('Unsupported store edit');
                }

                const key = Object.keys(store.getState())[index];

                if (!key || !store.canEdit(key)) {
                    throw new Error('Store state entry is read-only');
                }

                store.set(key, state.value);
            });
        }
    );
}
```

## Nekuta Adapter Target

Nekuta is the first concrete store adapter target for this ecosystem. Its adapter should begin as a custom inspector, not a custom tab:

- Inspector ID: `nekuta-stores`.
- Root nodes: one node per store/query module.
- Node metadata: module name, store kind, subscription count, and source file when known.
- State groups: `state`, `getters`, `actions`, `subscriptions`, and `metadata` when available.
- Editable entries: only writable state fields. Derived getters and action metadata should be read-only.
- Timeline layer: store actions, async transitions, subscription broadcasts, and rejected edits.

The first Nekuta adapter should avoid private runtime assumptions where possible. If a store cannot expose a complete tree, return the nodes that are known and include a `metadata` state group that explains which runtime data was unavailable. This keeps DevTools useful without tying the adapter to unstable internals.
