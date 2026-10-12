# R03: Backend-Confirmed Sessions

Issue: [#248](https://github.com/jared-leddy/react-devtools/issues/248).

## Contract

`createDevToolsSession` from `@devtools/core/browser` exposes a stable snapshot,
`subscribe`, idempotent `connect`, and idempotent `dispose`. Protocol version 1
requires a server identity, initial core state and seven explicit boolean
capabilities. A transport connection alone cannot publish Connected. Rejection,
missing capabilities, mismatched versions, timeout and disconnect during the
handshake fail closed. Timeout-only retries accommodate native backend injection;
the default overall deadline is five seconds. A disposed or failed session is
terminal: create a fresh session for a new attempt. Automatic recovery is R08.

Snapshots contain renderer/root data from the backend. No DOM-derived component
source is added. The core callbacks now deliver state patches and transport
changes; servers publish store updates. Subscription ordering, batching and full
navigation behavior remain R04/R08. Inspect/edit/store capabilities are false
until their actual operations are available; capability presence is not UI support.
Native sessions currently advertise roots only; their snapshot excludes eager
component/context values. The existing backend inspection functions remain for
R05/R06 to connect with transport-safe value serialization. Generic core servers
retain their own explicit capabilities.

## Embedding And Ownership

```tsx
import { createDevToolsSession } from '@devtools/core/browser';
import { mountDevToolsClient } from '@devtools/client';

const session = createDevToolsSession({ preset: 'extension' });
const client = mountDevToolsClient(element, { session });
// The mount owns its supplied session and disposes it on unmount.
client.unmount();
```

Both native panel bootstraps use this API. The provider owns one effective
external-store subscription, shared by consumers; connection begins outside
StrictMode effect replay. Compiled public type examples are checked under
`packages/devtools-client/type-tests`.

The overlay accepts a **borrowed** `session` prop, relays backend-confirmed
snapshots into its iframe and disposes only its relay. Reloading the iframe
replaces the relay. This read-only relay does not advertise component operations.
Standalone hosts can pass a session to mount, or opt into the built-in entry
using `?__devtools_session=iframe`, `broadcast-channel`, or `vite`; a corresponding
real server must exist. A Vite WebSocket connection is not a successful handshake.
The separate-window overlay requires its own transport/session rather than the
iframe relay.

Existing callers without a session remain source-compatible. Their default
annotated-DOM/legacy overview path is **not** migrated or claimed backend-confirmed
by R03; R05 removes that legacy source/fallback. Session-backed Components is
explicitly unavailable until R05 instead of showing synthetic fixtures. The old
presentation remains: no Vue visual parity, working component inspector, official
hook coexistence or approved browser-store distribution is claimed here.

## Native Startup Corrections

- Chrome's native host loads after removing `frame-ancestors 'none'` from the
  extension policy. Self-only script/style policy and object restrictions remain.
- Both browsers load the isolated proxy at document start. Opening DevTools does
  not supply the activeTab gesture needed by the old Chrome dynamic injection.
  Duplicate Firefox proxy injection is removed.
- Classic content/page scripts are emitted as independently bundled IIFEs. Firefox
  MV2 background also uses classic delivery. There are no module imports in those
  assets and independently minified lexical names no longer collide. Module-based
  HTML panel/popup entries remain module bundles.
- The native panel is registered even on non-React pages, so connection/no-renderer
  states can be inspected. Actual renderer detection comes from the handshake.
- A delayed tab `loading` event resets the detection badge without deleting live
  relay ports. Native Next.js traces showed backend readiness but no incoming
  handshake before this correction; afterwards both native panels connect. Port
  disconnect/tab removal still release the relay. Full navigation recovery is R08.
- Shared Chrome content sources and the classic build plugin invalidate Turbo
  caches, including Firefox's independently built shared content scripts.

The new build regression gate parses/runs two independently compiled scripts
with colliding source names and asserts missing entries fail the build.

## Verification

Formatting, ESLint, public API typechecks, unit coverage, build, bundle checks,
release-packaging tests, Firefox helper tests, classic-script tests and all eight
product smoke cases pass. The existing 80% global Jest gates and Node coverage
guards are unchanged. Bundle budgets are unchanged. Native capture helpers are
explicit macOS manual diagnostic tools, not a cross-platform native CI claim.

Versions: workspace 0.1.9, core 0.0.22, kit 0.0.21, client 0.0.30,
overlay 0.0.9, Chrome 0.0.17, Firefox 0.0.8.

Native evidence and exact build/fixture identities are added below after fresh
installed-extension captures. Original owner screenshots remain private and are
excluded from this issue's commits and release artifacts.
