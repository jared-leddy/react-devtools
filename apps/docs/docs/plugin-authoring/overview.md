---
title: Plugin Authoring
---

# Plugin Authoring

Plugins extend React DevTools with framework, router, store, and product-specific debugging surfaces. The public API is intentionally small:

- Use [store adapters](./store-adapters.md) for library-owned state trees and editable state.
- Use [router adapters](./router-adapters.md) for route tables, current route state, and navigation actions.
- Use custom tabs only when your integration needs a full product surface that does not fit the tree/state inspector model.
- Use timeline layers for temporal events such as actions, cache invalidations, network updates, or suspense transitions.

Every plugin starts with `setupDevToolsPlugin` from `@devtools/api`:

```ts
import { setupDevToolsPlugin } from '@devtools/api';

setupDevToolsPlugin(
    {
        id: 'my-library',
        label: 'My Library',
        packageName: '@my-library/devtools-plugin'
    },
    (api) => {
        api.notify('My Library DevTools plugin registered.');
    }
);
```

Prefer stable IDs, serializable metadata, and graceful fallbacks. DevTools should keep working when a library is partially initialized, an optional runtime API is unavailable, or a user is inspecting server-rendered markup before hydration completes.

## Registration And Lifecycle

Install `@devtools/api` in your integration package and call registration from
the inspected application's development entry point, before or after mounting
React. Use the [install guide](../getting-started/overview.md) to connect the
DevTools client. Registering a plugin alone does not install a panel or transport.
Keep registration out of production bundles, for example behind
`if (import.meta.env.DEV)` in a Vite application.

`setupDevToolsPlugin(descriptor, setup)` returns `void`. Registration is buffered
until a delivery runtime supplies a context and a React root is available.
The setup callback then receives `PluginSetupContext`, the public structural
contract implemented by the internal `DevToolsPluginAPI` class. Import the
context type from `@devtools/api`; the implementation class is not exported by
that facade. `setupDevtoolsPlugin` is a compatibility spelling of the same function.

Plugin IDs are deduplicated: the first installation wins. Inspector IDs are
global, so namespace them with your library name. There is currently no public
plugin unregister function or setup cleanup return value. Avoid registration
inside component render functions, and use a full page reload when changing
setup behavior during development. Async setup is allowed, but the registry
does not await it; catch initialization failures inside your callback.

The descriptor requires `id` and `label`. Optional fields are `app` (your runtime
instance, available as `api.app`), `packageName`, `homepage`, `logo`, and
`settings`. Do not put private data or raw React Fibers into transported values.

## A Complete Counter Inspector

Create `counter-devtools.ts` with this complete implementation. It owns a single
counter and allows only finite numeric replacement edits; rename, removal, and
nested edits are rejected before mutation.

```ts
import { setupDevToolsPlugin } from '@devtools/api';

export const counter = { count: 0 };
const inspectorId = 'example-counter:state';

setupDevToolsPlugin({ id: 'example-counter', label: 'Counter' }, (api) => {
    const snapshot = () => ({
        state: [{ key: 'count', value: counter.count, editable: true }]
    });

    api.addInspector({ id: inspectorId, label: 'Counter' });
    api.on.getInspectorTree(inspectorId, ({ filter }) =>
        !filter || 'counter'.includes(filter.toLowerCase())
            ? [{ id: 'counter', label: 'Counter' }]
            : []
    );
    api.on.getInspectorState(inspectorId, ({ nodeId }) =>
        nodeId === 'counter'
            ? snapshot()
            : { error: [{ key: 'message', value: 'Unknown counter' }] }
    );
    api.on.editInspectorState(inspectorId, ({ nodeId, path, state }) => {
        if (
            nodeId !== 'counter' ||
            path.length !== 3 ||
            path[0] !== 'state' ||
            path[1] !== 0 ||
            path[2] !== 'value' ||
            state.remove ||
            state.newKey != null ||
            typeof state.value !== 'number' ||
            !Number.isFinite(state.value)
        ) {
            throw new Error('Only finite counter value edits are supported');
        }

        counter.count = state.value;
        api.setInspectorState(inspectorId, nodeId, snapshot());
    });
});
```

Import `./counter-devtools` once from your development entry point. Open the
Vite overlay, select the Counter custom inspector, and select its Counter node.
The state group should show `count: 0`. Edit it to `5`, reselect the node, and
confirm it still reads `5`. Filter the tree by `counter` and then by `missing`;
the latter should return no nodes. Refresh the page to reset the counter.
The counter is a plain object: a library integration must additionally use its
own subscription or mutation API to update application views.

## API Reference

Handlers receive requests from the client and may return synchronously or as
promises. Register handlers once per inspector; registering another handler for
the same inspector and operation replaces the previous handler.

| Member                                                                    | Contract                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptor`, `app`                                                       | Registration metadata and optional library instance.                                                                                                                                                                                                       |
| `addInspector(options)` / `registerInspector(options)`                    | Register an inspector with required `id` and `label`; the latter is an alias. Optional fields include `icon`, `noSelectionText`, filter placeholders, `actions`, and `nodeActions`. Action metadata alone does not supply an action callback.              |
| `on.getInspectorTree(id, handler)`                                        | Receives `{ inspectorId, filter? }`; returns nodes or `{ inspectorId, rootNodes }`. Nodes require `id` and `label`, and may include `children`, `tags`, `metadata`, `file`, and `name`. Apply filtering in the handler.                                    |
| `on.getInspectorState(id, handler)`                                       | Receives `{ inspectorId, nodeId }`; returns grouped state or `{ inspectorId, nodeId, state }`. Each group is an array of `{ key, value, editable? }`. Missing handlers produce empty state.                                                                |
| `on.editInspectorState(id, handler)`                                      | Receives `{ inspectorId, nodeId, path, state, type? }`. `state` contains optional `value`, `newKey`, and `remove`; `path` indexes the returned groups and entries, not the library's raw object. Validate ownership, path, and mutation permissions.       |
| `sendInspectorTree(id, filter?)`                                          | Invoke the tree handler, emit the response through context hooks, and return a promise of the normalized tree response.                                                                                                                                    |
| `sendInspectorState(id, nodeId)`                                          | Invoke the state handler, emit the response, and return a promise of the normalized state response.                                                                                                                                                        |
| `setInspectorState(id, nodeId, state)`                                    | Emit a computed snapshot without invoking the state handler. Keep the handler reading the same current library state for subsequent requests.                                                                                                              |
| `editInspectorState(request)`                                             | Await the registered edit handler and emit an edit request hook. A missing handler performs no library mutation.                                                                                                                                           |
| `selectInspectorNode(id, nodeId)`                                         | Emit a selection request through context hooks.                                                                                                                                                                                                            |
| `addTimelineLayer({ id, label, color? })`                                 | Register a named event layer.                                                                                                                                                                                                                              |
| `addTimelineEvent({ layerId, title, subtitle?, data?, groupId?, time? })` | Emit an event; omitted time defaults to `now()`, which uses `Date.now()` milliseconds.                                                                                                                                                                     |
| `getSettings()` / `setSettings(values)`                                   | Read and update descriptor-defined settings. Settings use boolean, text, number, or choice definitions with a `label` and `defaultValue`; choices require `options`, numbers can specify `min`, `max`, and `step`. Persistence depends on runtime storage. |
| `registerRouterAdapter(adapter)`                                          | Register a router adapter scoped by plugin ID and adapter ID; see [router adapters](./router-adapters.md).                                                                                                                                                 |
| `notify(message)`                                                         | Currently a no-op. Do not rely on it to display validation errors; throw edit errors or expose an error state.                                                                                                                                             |

`addCustomTab`, `addCustomCommand`, and `removeCustomCommand` are separate exports
from `@devtools/api`, not methods on the setup context. A tab requires `name` and
`title`; a command requires `id` and `label`. Use globally distinct identifiers.

## React State And Library State

The generic React component tree and its props/hooks/state view are read-only.
They expose serialized React observations; they do not provide a stable,
supported setter for arbitrary Fiber state. Plugin edits must never mutate raw
Fibers or assume that editing a serialized snapshot changes React.

Custom inspectors can support editing because their adapters own the mutation
contract. Set `editable: true` only for entries that your library can safely
write, register an edit handler, and use the library's supported setter or patch
API. Keep derived values and action metadata read-only. An editable flag is UI
metadata, not authorization: validate every request in the handler.

## Nekuta As A Worked Integration

The shipped `@devtools/nekuta-plugin` applies this contract to real stores:

```ts
import { registerNekutaDevTools } from '@devtools/nekuta-plugin';

// Run in the development browser entry after creating your Nekuta instance.
registerNekutaDevTools({ nekuta });
```

Here `nekuta` is the application's existing Nekuta instance. Omitting it uses
`getActiveNekuta()`. The options also accept a plugin `id` and `label`, but the
inspector and timeline IDs remain fixed; this is not multiple-instance isolation.

Registration creates `nekuta-stores` and the `nekuta-actions` timeline layer.
The tree handler reads `nekuta._s`, filters store IDs case-insensitively, and
returns nodes keyed by `$id`, with a `store` tag and metadata containing action
count and state keys. This adapter currently depends on that private registry.
No active instance yields an empty tree.

The state handler finds the selected store and groups `$state` entries as editable
`state`, non-function derived fields as read-only `getters`, functions as
read-only `actions`, and counts/ID as `metadata`. Values pass through the core
display formatter. A missing store returns an `error` group.

An edit must target the `state` group and a numeric entry index. The adapter
resolves that index against `$state` keys and accepts `value` or the resolved
key as the field. It applies replacement through `$patch({ [key]: value })`,
or a patch callback for remove/rename. It then publishes the new snapshot and
adds a `State edited` event containing operation, key, path, and value.
It does not currently capture all application actions, subscriptions, or async
transitions. Follow this read/mutate/refresh pattern for your library, while
validating values and using public library APIs wherever available.

## Transport And Verification Limits

The current custom-inspector bridge supports local registrations and a
same-origin parent window bridge, which is used by the embedded iframe client.
The public contract does not guarantee that arbitrary plugin registrations or
edits cross an extension messaging boundary. Verify each delivery mode you
intend to support; do not infer extension support from an overlay test.
Context-hook snapshots also normalize nodes/state and can omit rich metadata.
Prefer JSON-safe values even when a local bridge accepts richer objects.

Use the complete counter above as a manual smoke test, then verify your own
integration with an absent library instance, unknown nodes, invalid edit paths,
read-only values, and rejected writes. The [architecture overview](../architecture/overview.md)
explains the runtime boundaries; [store adapters](./store-adapters.md) expands
the mutation patterns.
