# React Renderer And Root Detection Contract

This contract defines the boundary between the low-level React hook adapter in
`@devtools/kit`, the future Fiber walker, and the runtime/RPC state in
`@devtools/core`.

## Hook Ownership

Detection must compose with any existing `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`.
The detector calls `createDevToolsHook` from `@devtools/kit` and uses the
returned installation mode:

- `installed`: no compatible hook existed, so the project-owned hook is installed.
- `wrapped`: a compatible existing hook remains the global hook and its methods
  are wrapped.
- `disabled`: an incompatible hook is left in place and the detector reports a
  `DetectionDiagnosticRecord` with code `existing-hook-incompatible`.

The wrapper must never replace a compatible existing hook object. It may wrap
methods only to emit normalized events after the original method runs.

## Hook Methods Used

The detector relies on these hook methods and events:

- `inject(renderer)`: emits renderer metadata and returns the renderer id.
- `getFiberRoots(rendererID)`: snapshots currently known roots for reconnects.
- `onCommitFiberRoot(rendererID, root, priorityLevel, didError)`: records root
  addition, commit, and update events.
- `onPostCommitFiberRoot(rendererID, root)`: confirms a committed root after
  React has finished post-commit work.
- `onCommitFiberUnmount(rendererID, fiber)`: marks affected root/component
  records stale when a subtree unmounts.
- `on`, `off`, `once`, `sub`, and `emit`: subscribe to normalized hook events
  without binding detector code to a concrete hook implementation.

Every emitted detection event must include `targetId`, `rendererId` when known,
and a timestamp. The UI must not inspect raw hook objects directly.

## Renderer Metadata

Each renderer becomes a `RendererRecord` in `DevToolsCoreState.renderers`.
Metadata captured from `hook.inject(renderer)` includes:

- `id`: the renderer id returned by the hook.
- `targetId`: the window, iframe, or worker target where the renderer was found.
- `name` and `packageName`: best-effort package labels such as `react-dom`.
- `version` and `reconcilerVersion`: best-effort versions from renderer fields.
- `bundleType`: renderer bundle type when React exposes it.
- `capabilities`: booleans for fiber roots, renderer interface, and profiling.
- `detectedAt`: epoch milliseconds when the renderer was observed.

Unsupported, minified, or partial renderers still get a renderer record when an
id exists, plus a client-visible diagnostic explaining missing capabilities.

## Root Lifecycle

Roots are represented by `RootRecord` and their event history is represented by
`FiberRootEventRecord`.

Lifecycle values are:

- `added`: first observation from `getFiberRoots` or the first commit.
- `committed`: `onCommitFiberRoot` completed for an existing root.
- `updated`: post-commit or later refresh updated the root metadata.
- `unmounted`: React reported unmount activity for fibers under the root.
- `disconnected`: the owning target, renderer, or transport disappeared.

`rootId` must be stable within a target and must include enough namespace to
avoid collisions across renderers and frames. The canonical format is:

```text
target:<targetId>/renderer:<rendererId>/root:<detectorRootId>
```

When a raw Fiber root has no stable native id, the detector assigns a per-target
WeakMap id and uses that value as `detectorRootId`.

## Iframes And Portals

Each inspected browsing context gets a `DetectionTargetContext`:

- top window: `{ id: "top", kind: "window", framePath: [] }`
- iframe: `kind: "iframe"` with `parentId` and a deterministic `framePath`
- worker-like target: `kind: "worker"` when no DOM window exists

Iframe roots keep their own `targetId`; they are not merged into the parent
window. Portal content keeps the owner root as `parentRootId` and may set
`portalContainerId` when the host container is identifiable.

## Fallbacks And Diagnostics

Unsupported React versions, missing Fiber internals, minified renderer fields,
cross-origin frames, or detector exceptions must fail visibly through
`DetectionDiagnosticRecord`.

Diagnostics use these codes:

- `existing-hook-incompatible`
- `fiber-root-unavailable`
- `react-internals-unavailable`
- `renderer-unsupported`
- `unknown-detector-error`

The client should show `error` diagnostics in the connection/status surface,
show `warning` diagnostics near partial data, and keep `info` diagnostics for
debug logs.

## Core RPC Events

Detector implementations publish state through the `@devtools/core` RPC facade:

- `updateRenderers(renderers)` for renderer snapshots.
- `recordFiberRootEvent(rootEvent)` for root lifecycle transitions.
- `updateRoots(roots)` for authoritative root snapshots.
- `reportDetectionDiagnostic(diagnostic)` for client-visible fallbacks.
- `getRenderers()`, `getRoots()`, and `getDetectionDiagnostics()` for client
  hydration and reconnection.

Low-level hook objects, renderer interfaces, Fiber roots, and Fiber nodes must
not cross the RPC boundary. Future Fiber walkers should serialize them into
core records before sending data to clients.
