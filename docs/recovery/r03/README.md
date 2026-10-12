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

Original owner screenshots remain private and are excluded from this issue's
commits and release artifacts.

## Installed Native Evidence

Production source commit: `d9333a85ead883db4d4358f5b6edf055558c7582`.
Captured October 12, 2026, on macOS 15.5, Node 24.16.0, Chrome 154.0.8037.98
and Firefox Developer Edition 158.0 (build `20261007115609`). Each capture uses
a new disposable profile and the actual unpacked/temporary installed extension.
The later evidence-only commit does not change the captured application code.
[Verification](evidence/verification.json) records executable build, fixture and
release ZIP hashes plus the tested package coverage. [Checksums](evidence/checksums.json)
cover the redacted observations and unedited screenshots.

| Fixture                                                    | Chrome Native                                                                         | Firefox Native                                                                          | Observed Result                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| R02 unannotated React fixture, `:9052/react`               | [Observation](evidence/chrome-react.json), [image](evidence/chrome-react.png)         | [Observation](evidence/firefox-react.json), [image](evidence/firefox-react.png)         | Connected, React 19.1.1, one real root                                      |
| Next 15.5.25 development Pages fixture, `:9050/pages-demo` | [Observation](evidence/chrome-next.json), [image](evidence/chrome-next.png)           | [Observation](evidence/firefox-next.json), [image](evidence/firefox-next.png)           | Connected, React 19.1.1 and 19.2.0-canary-0bdb9206-20250818, two real roots |
| Plain HTML control, `:9051/non-react`                      | [Observation](evidence/chrome-non-react.json), [image](evidence/chrome-non-react.png) | [Observation](evidence/firefox-non-react.json), [image](evidence/firefox-non-react.png) | Backend Connected, no renderers or roots; no invented app data              |

Chrome observations include real `chrome.devtools.inspectedWindow.tabId`, evaluated
inspected URL, registered native panel identity and actual panel text. The auto-opened
unrelated blank tab is retained in observations: its eval permission failure and
handshake timeout are expected and never show Connected. The shown narrow native
screenshots cannot display every row at once; text observations record all roots.
Chrome's native host screenshot omits the inspected page's pixels; tab identity is
established by the inspectedWindow result, not inferred from that blank region.

Firefox observations record actual app hook data, toolbox registration, selected
tab URL and distinct inspected/panel browsing-context IDs. Its remote extension
browser prevents synchronous `contentDocument` panel-text access: null text/URL
is recorded honestly, and the native screenshots were visually inspected for
Connected and matching renderer/root data. Firefox profile paths/process IDs are
redacted. No fake inspectedWindow object, RPC reply or synthetic component source
is installed by these final capture helpers.

Metadata not supplied by the backend remains Unknown/Not available. In particular,
the Next first root currently loses its renderer link during backend refresh;
R04 must preserve root metadata when integrating ordered refresh updates. This
does not change the observed root count or invent an association. Full component
inspection, store integration, visual redesign and official-extension coexistence
remain explicitly outside this evidence.

## Reproduce

Build first; do not run Next development while build/typecheck write `.next`.
Start `node docs/recovery/r02/serve-fixture.mjs` and, in `apps/playground`,
`npx next dev --port 9050`. Serve the exact negative control separately:

```sh
node -e 'require("node:http").createServer((_req,res)=>res.end(require("node:fs").readFileSync("docs/recovery/r03/evidence/non-react.html"))).listen(9051,"127.0.0.1")'
```

For each of the three URLs above run
`node scripts/native-session-chrome.mjs <url> <output-directory>` and
`node scripts/native-session-firefox.mjs <url> <output-directory>`. These diagnostic
tools require installed macOS Chrome/Firefox Developer Edition, GUI permission,
free ports 9351/2829 and current native internal DevTools APIs. Firefox uses an
unsigned temporary add-on; Chrome uses its explicit extension-debugging flag.
They do not constitute normal store distribution or cross-platform CI coverage.
Inspect actual identities and screenshots, not just process exit codes. Stop the
fixture servers after verification. R29/R30 own durable native regression suites.
