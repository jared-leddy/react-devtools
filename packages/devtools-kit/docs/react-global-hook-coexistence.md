# React Global Hook Coexistence

Issue: [P1-04](https://github.com/jared-leddy/react-devtools/issues/59)

## Decision

`@devtools/kit` must not replace an existing `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`.

The Phase 1 hook implementation should use this order:

1. If the official React DevTools hook already exists, preserve the object identity and install our observer as a secondary listener/wrapper.
2. If no hook exists and the runtime is owned by our devtools delivery mode, install a minimal React-compatible hook object.
3. If another non-compatible hook exists, leave it in place, emit a development warning, and disable React tree capture until a compatible integration is available.

## Rationale

React renderers look for the single global hook during renderer initialization. When the hook exists, React calls `hook.inject(internals)` and then stores that same hook for later commit/unmount callbacks. Replacing the object after React has injected does not move the renderer to the new hook, and replacing it before React injects prevents the official extension from seeing renderers.

The official React DevTools hook installer also guards the slot before installation. If `window` already owns `__REACT_DEVTOOLS_GLOBAL_HOOK__`, the official installer exits instead of replacing it. That makes an app-installed hook risky unless we know we are in an owned/no-extension mode.

Vue Devtools takes the safer precedent for shared globals: it defines the global only when absent and augments the existing hook when present. React needs the same respect for object identity, with React-specific wrapping around `inject`, `onCommitFiberRoot`, `onPostCommitFiberRoot`, and `onCommitFiberUnmount`.

## P1-05 Implementation Contract

`createDevToolsHook()` should expose an installation result with at least these states:

- `mode: "wrapped"` when an existing compatible React hook was augmented.
- `mode: "installed"` when our minimal hook was created because no hook existed.
- `mode: "disabled"` when a conflicting incompatible hook was detected.

For `wrapped`, the implementation should:

- Preserve `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` object identity.
- Preserve original return values from `inject`.
- Call original hook methods first, then notify our observer.
- Avoid throwing from observer callbacks.
- Keep official `renderer`, `renderer-attached`, `rendererInterfaces`, `renderers`, and `getFiberRoots` behavior intact.

For `installed`, the implementation should:

- Define a non-enumerable `__REACT_DEVTOOLS_GLOBAL_HOOK__` property.
- Set `supportsFiber: true`.
- Implement `inject`, `on`, `off`, `sub`, `emit`, `getFiberRoots`, `onCommitFiberRoot`, `onPostCommitFiberRoot`, and `onCommitFiberUnmount`.
- Maintain renderer ids, renderer maps, and root sets so later backend code can hydrate current renderers.

## Prototype Result

Run:

```sh
npm run prototype:global-hook --workspace=@devtools/kit
```

The prototype demonstrates:

- Wrapping an existing official-style hook preserves object identity and lets both the official hook and our observer receive renderer/commit/unmount events.
- Replacing an existing hook causes the original official hook to miss the renderer.
- Installing a minimal hook when no hook exists lets React inject and commit without throwing.

## Manual Verification

P1-05 should manually verify this in a browser with the official React DevTools extension enabled:

1. Load the playground with the official extension enabled.
2. Install our hook adapter before React app initialization.
3. Confirm the official React DevTools panel still shows the app tree.
4. Confirm our adapter observes renderer injection and commit/unmount events.
5. Reload with the official extension disabled and confirm our minimal hook installs without throwing.

## References

- React DevTools shared hook installer: https://github.com/facebook/react/blob/main/packages/react-devtools-shared/src/hook.js
- React extension content-script hook guard: https://github.com/facebook/react/blob/main/packages/react-devtools-extensions/src/contentScripts/installHook.js
- React reconciler hook injection path: https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberDevToolsHook.js
- Vue Devtools hook installation precedent: `devtools/packages/devtools-kit/src/core/index.ts`
