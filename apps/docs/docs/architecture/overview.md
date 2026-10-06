---
title: Architecture
---

# Architecture

React DevTools is a monorepo with a deliberately narrow set of package
boundaries. The runtime is split this way so React internals, transport code,
plugin APIs, and the panel UI can evolve without every feature reaching across
the whole tree.

Use this page when deciding where to put new runtime, UI, transport, delivery,
or adapter work.

## Package Boundaries

| Package                         | Owns                                                                                                                                                               | Put work here when                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `@devtools/shared`              | Small shared utilities and browser-safe helpers.                                                                                                                   | Multiple packages need the same low-level utility and it has no React, transport, or UI dependency.                               |
| `@devtools/kit`                 | Global hook coexistence, transport presets, plugin registry, custom inspectors/tabs/commands, router adapter contracts, and low-level serializable types.          | You are changing how runtimes connect, how plugins register, or the public primitive types used by plugins and delivery packages. |
| `@devtools/core`                | Serialized runtime state, Fiber/root records, Fiber walking helpers, diagnostics, highlighter helpers, and the RPC facade used by clients and servers.             | You are adding runtime data, detection diagnostics, Fiber traversal, value formatting, or RPC methods.                            |
| `@devtools/api`                 | The public plugin-author entry point that re-exports the stable plugin API from `@devtools/kit`.                                                                   | You are exposing something that third-party plugin authors should import directly. Keep this package small.                       |
| `@devtools/ui`                  | Reusable React design-system components and shared panel styling primitives.                                                                                       | You are building a generic UI control or visual primitive used by more than one app/package.                                      |
| `@devtools/client`              | The React DevTools panel shell: routes, tabs, component tree, state viewer, assets, graph, settings, custom plugin surfaces, and client-side commands.             | You are changing what users see in the DevTools panel or how panel routes consume already-serialized data.                        |
| `@devtools/devtools-overlay`    | Embedded overlay launcher and iframe transport host used by app-side delivery modes.                                                                               | You are changing the in-page overlay or embedded iframe handoff.                                                                  |
| `@devtools/vite-plugin`         | Vite HTML injection, served client/overlay assets, Vite-specific transports, source metadata annotation, asset RPC, module graph RPC, and open-in-editor endpoint. | You are changing Vite delivery or Vite-only development features.                                                                 |
| `@devtools/chrome-extension`    | Chrome Manifest V3 shell, popup, DevTools panel entry, background scripts, content scripts, permissions, and extension bridge.                                     | You are changing Chrome extension delivery, manifest permissions, or content-script behavior.                                     |
| `@devtools/firefox-extension`   | Firefox extension shell, popup, DevTools panel entry, background scripts, content scripts, permissions, and Firefox-specific bridge.                               | You are changing Firefox delivery or Firefox-specific extension behavior.                                                         |
| `@devtools/react-router-plugin` | React Router adapter plugin.                                                                                                                                       | You are adding React Router route tables, navigation actions, or route source metadata.                                           |
| `@devtools/nextjs-plugin`       | Next.js App Router and Pages Router adapter plugin.                                                                                                                | You are adding Next.js route normalization, current route state, or navigation/file actions.                                      |
| `@devtools/nekuta-plugin`       | Nekuta store adapter plugin.                                                                                                                                       | You are adding Nekuta-specific store inspection, editable state, diagnostics, or actions.                                         |
| `apps/playground`               | Next.js playground and manual fixtures.                                                                                                                            | You need a Next.js/Pages/App Router fixture for development or QA.                                                                |
| `apps/vite-playground`          | Vite playground and manual fixtures.                                                                                                                               | You need Vite delivery, plain React, router, Nekuta, asset, graph, multi-root, or plugin dogfood fixtures.                        |
| `apps/docs`                     | Docusaurus documentation site.                                                                                                                                     | You are documenting installation, architecture, troubleshooting, delivery modes, or plugin authoring.                             |

The old task list sometimes used names such as `devtools-shared`. In code, the
package is `@devtools/shared`.

## Layering Rules

The intended dependency direction is:

```text
adapters/plugins -> @devtools/api -> @devtools/kit
delivery packages -> @devtools/client + @devtools/core + @devtools/kit
@devtools/client -> @devtools/api + @devtools/kit + @devtools/ui
@devtools/core -> @devtools/kit
@devtools/kit -> @devtools/shared
```

Keep these rules in mind:

- Raw React hook objects, renderer interfaces, Fiber roots, and Fiber nodes stay
  inside runtime/delivery code until `@devtools/core` serializes them.
- `@devtools/client` should render serialized records and call RPC/plugin APIs;
  it should not inspect raw React internals.
- `@devtools/api` should stay a stable facade. Do not put internal registry or
  transport implementation there.
- Delivery packages may depend on the client and core packages, but core should
  not import delivery packages.
- Adapters should fail closed with diagnostics or empty snapshots when their
  host library is unavailable.

## Runtime Data Flow

The core runtime flow is the same across delivery modes:

```text
React renderer
  -> window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  -> hook events from @devtools/kit
  -> runtime detector / delivery bridge
  -> @devtools/core records + diagnostics
  -> @devtools/core RPC
  -> @devtools/client routes and panels
```

The RPC boundary is where raw runtime state becomes client-safe data:

```text
inspected page or extension content script
  updateRenderers(renderers)
  recordFiberRootEvent(rootEvent)
  updateRoots(roots)
  reportDetectionDiagnostic(diagnostic)
          |
          v
@devtools/core store
          |
          v
client RPC queries:
  getOverview()
  getRenderers()
  getRoots()
  getComponents()
  getDetectionDiagnostics()
```

Add a new RPC method when a client feature needs a new serialized capability
that cannot be derived from existing state. Add a new client route or card only
after the runtime contract exists.

## Root And Fiber Lifecycle

React reports renderer and root changes through the global hook. `@devtools/kit`
owns hook installation/coexistence; `@devtools/core` owns normalized records and
diagnostics.

```text
Page loads
  -> DevTools installs or wraps the compatible global hook
  -> React renderer calls hook.inject(renderer)
  -> renderer record is created
  -> React commits a Fiber root
  -> root event is recorded as added/committed/updated
  -> Fiber walker serializes component records
  -> client refreshes tree, overview, state, and diagnostics
```

Root lifecycle values are intentionally separate from component tree rows:

- `added`: first observation from `getFiberRoots` or the first commit.
- `committed`: `onCommitFiberRoot` completed for an existing root.
- `updated`: post-commit or refresh updated root metadata.
- `unmounted`: React reported unmount activity under the root.
- `disconnected`: the owning target, renderer, or transport disappeared.

Fiber work belongs in `@devtools/core` when it touches tags, owners, props,
state, source locations, diagnostics, highlighter lookups, or serialized
component records. UI work belongs in `@devtools/client` after the Fiber data is
already normalized.

## Plugin Lifecycle

The renderer observation path and plugin path meet in the client, but plugins
read their library directly rather than deriving store state from React Fibers:

```text
React renderer -> global hook -> delivery bridge -> core serialization
                                       |                  |
                                 transport/RPC ---------> client
                                                          ^
Library -> setupDevToolsPlugin -> kit registry/plugin API  |
                                  |                       |
                             inspector handlers -> plugin bridge
                                  ^                       |
                                  +--- tree/state/edit ---+
```

The transport is selected by the delivery package. Custom inspector requests
currently use local or same-origin parent-window plugin bridges; extension
transport support must be verified separately. See the
[plugin-authoring guide](../plugin-authoring/overview.md) for a complete inspector,
the setup context reference, and the shipped Nekuta integration.

Plugins use `setupDevToolsPlugin` from `@devtools/api`. Internally, the registry
lives in `@devtools/kit`.

```text
plugin package imports @devtools/api
  -> setupDevToolsPlugin(descriptor, setup)
  -> setup receives PluginSetupContext
  -> plugin registers inspectors, router adapters, tabs, commands, timeline
     layers, and settings
  -> @devtools/client reads the registry and renders plugin surfaces
  -> inspector tree/state/edit requests flow back through registered handlers
```

Use the smallest plugin surface that fits the feature:

- Custom inspector: tree/state UI with optional editable fields.
- Router adapter: framework-owned route tree, current route state, navigation,
  and open-file actions.
- Store adapter: library-owned state trees, derived values, actions, and
  editable fields.
- Custom command: command palette or quick action.
- Custom tab: a larger product surface that does not fit an inspector.
- Timeline layer/event: temporal events such as actions, route transitions, or
  cache invalidations.

Plugin packages should depend on `@devtools/api`, not `@devtools/kit`, unless
they are intentionally testing or dogfooding internal primitives.

## Delivery Mode Differences

Delivery packages answer one question: how does the client and runtime bridge get
onto the inspected page?

| Delivery mode           | Package                                              | Transport shape                                                                                          | Use when                                                                              |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vite plugin             | `@devtools/vite-plugin`                              | Vite middleware, websocket transport, served client/overlay assets, same-origin open-in-editor endpoint. | The app is served by Vite during development and can receive HTML/module injection.   |
| Chrome extension        | `@devtools/chrome-extension`                         | Browser DevTools page, background service worker, content scripts, extension messaging.                  | The user installs a Chrome extension and inspects arbitrary HTTP/HTTPS pages.         |
| Firefox extension       | `@devtools/firefox-extension`                        | Browser DevTools page, background scripts, content scripts, Firefox extension messaging.                 | The user installs a Firefox extension and inspects arbitrary HTTP/HTTPS pages.        |
| Embedded overlay        | `@devtools/devtools-overlay` plus a delivery package | In-page launcher and iframe host.                                                                        | A delivery mode wants an app-local overlay instead of only a separate DevTools panel. |
| Standalone client build | `@devtools/client`                                   | Static client shell waiting for a configured transport.                                                  | Tests, package consumers, or delivery packages need a bundled panel surface.          |

Vite owns Vite-only development features such as module graph, asset explorer,
source metadata transforms, and open-in-editor. Extension packages own manifest
permissions, popup state, content-script bootstrapping, and browser-specific
messaging.

## Where To Put New Work

| New work                                                               | Start in                                    | Notes                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| New runtime diagnostic code                                            | `@devtools/core`                            | Delivery code may report it, but the code/type should live in core when clients consume it. |
| New React hook or transport primitive                                  | `@devtools/kit`                             | Keep low-level hook and messaging behavior out of UI packages.                              |
| New component tree/Fiber field                                         | `@devtools/core`                            | Serialize it before the client renders it.                                                  |
| New panel route, tab, toolbar, or settings control                     | `@devtools/client`                          | Use `@devtools/ui` only if the control is reusable across packages.                         |
| New design-system component                                            | `@devtools/ui`                              | Keep package-specific business logic out of UI primitives.                                  |
| New Vite-only endpoint or middleware                                   | `@devtools/vite-plugin`                     | Add tests around request handling and served assets.                                        |
| New Chrome/Firefox permission, popup state, or content script behavior | Matching extension package                  | Update manifest tests and manual verification docs.                                         |
| Public plugin API                                                      | `@devtools/api` plus `@devtools/kit`        | Add implementation in kit and re-export stable author-facing types from api.                |
| Library/framework adapter                                              | Dedicated plugin package                    | Prefer `@devtools/api` and keep host-library assumptions local to the adapter.              |
| Fixture to exercise behavior                                           | `apps/playground` or `apps/vite-playground` | Pick the playground that matches the delivery mode or framework.                            |

## Related Architecture Notes

More detailed runtime contracts live next to the packages they constrain:

- `packages/devtools-kit/docs/react-global-hook-coexistence.md`
- `packages/devtools-core/docs/react-renderer-root-detection.md`
- `packages/devtools-core/docs/react-devtools-backend-reuse-boundary.md`

Those notes are implementation contracts. This page is the contributor map for
choosing the right package before writing code.
