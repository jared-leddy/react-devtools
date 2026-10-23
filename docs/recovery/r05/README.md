# R05: Real Model Adapters

Issue: [#250](https://github.com/jared-leddy/react-devtools/issues/250).

## Authority And Hosts

Components come exclusively from a backend-confirmed session. The module-load
synthetic fallback and parent-document polling are removed. Useful large-tree
generators live under client test fixtures and are not exported or bundled.
The client converts the backend's flattened/nested records into one hierarchy,
retaining actual component/root identities and observed display names.

The inspected-page backend now lives in `@devtools/core/page-backend`; native
extensions retain only their bootstrap wrapper. Overlay iframes connect directly
to this backend. A supplied borrowed host session is relayed without acquiring
ownership. The separate-window link includes a per-opener random broadcast
channel, not a global shared default. Opening the client without a real host
cannot produce a Connected demo. Broadcast channel disposal closes native handles.

The Vite plugin installs the page hook before React through a blocking head script
or the first append-to module import. JSX/source annotations remain optional
enrichment, never a component authority. The smoke playground disables both kinds
of annotations. The overlay's own root and renderer are excluded from app facts.

## Inspector And Runtime Facts

The selected component fetches observed, formatted props and hook values through
the session. Updates invalidate/refetch selected values rather than serializing
every component's state at every commit. Requests are scoped to root/component;
replies cannot replace state after selection, stream, revision or disposal changes.
Inspection errors and unavailable capabilities remain visible, with no demo values.

Absent hosts start waiting, not Connected. Empty roots and non-React documents
have honest states; unsupported renderer diagnostics are carried to the client.
Overview has no hard-coded React version, invented app root, fabricated timing,
or count of the panel's own routes. Unknown facts remain unavailable. A Vite
websocket is transport availability, not proof that a React backend connected.

This is the basic read-only model adapter, not R06/R07's completed identity/value
inspection. Production names may be minified; hook-kind inference is limited in
production builds. Context/class-state completion and stronger value serialization
remain subsequent issues. Source actions are not offered without a backend action;
the old annotation-derived source action was removed. The legacy DOM picker cannot
manufacture a Fiber selection on an unannotated app; real picking remains R09.
Vue-quality shell/tree/inspector styling remains R16-R23, not claimed by this issue.

## Gates And Budgets

Required formatting, ESLint, typechecks, unit coverage (unchanged 80% global
statements/branches/functions/lines), packaging/helper guards, builds, bundle checks
and product smoke tests are run for delivery. Compiled transport integration and
new production-model guards are also checked. The CI model matrix exercises real
development, minified production, empty-root and non-React apps in both overlay
and standalone hosts. It is not a substitute for native-extension verification.

The overlay previously budgeted 230,000 raw / 75,000 gzip bytes for a shell and
metadata relay. Shipping an actual page backend adds roughly 40 KB raw. This PR
explicitly changes only that budget to 280,000 / 90,000 bytes. All other payload
budgets and all coverage thresholds remain unchanged. Bundle measurements are
included with the release evidence; this is not a silent global gate increase.

Versions: workspace 0.1.11; core 0.0.24; kit 0.0.23; client 0.0.32;
overlay 0.0.11; Vite plugin 0.0.13; Vite playground 0.0.11;
Chrome 0.0.19; Firefox 0.0.10 (Firefox 128+). Development release only.

## Evidence

[Build identity, archive hashes, bundle sizes and coverage](evidence/build.json),
[host matrix observations](evidence/hosts.json) and
[evidence checksums](evidence/SHA256SUMS) record the delivered build. Application
source is `5e3abcdcc7d593f9b5fe2dce2371cd89e6092d1b`; all captures were refreshed
after its unsupported-tree capability fix. Subsequent changes are verification
documentation only, not application JS.
All final native captures use the versioned builds and verified actual app context.

Installed Chrome 155.0.8059.85 and Firefox 159.0 each verified all four modes:
development and minified production show the observed `message` prop and hook
value changing from 0 to 1; empty roots have no component rows/values; non-React
Components panels show `No React detected`, not a fixture or an invented renderer.
The production component's observed short name is `vo`, not a naming replacement.
The native tab remains available on non-React pages to explain that state.

Visually checked, unedited native images and associated observations:
[Chrome development](evidence/chrome-development.png),
[Chrome production](evidence/chrome-production.png),
[Chrome empty](evidence/chrome-empty.png),
[Chrome non-React](evidence/chrome-non-react.png),
[Firefox development](evidence/firefox-development.png),
[Firefox production](evidence/firefox-production.png),
[Firefox empty](evidence/firefox-empty.png),
[Firefox non-React](evidence/firefox-non-react.png).
Each image has a same-named JSON report. Chrome values are scrolled into view in
the real native panel; no screenshot contents were edited.

The headless host matrix checks all four modes in both overlay and standalone,
with zero JSX/component annotations and live standalone values changing from 1
to 2. Examples: [standalone production](evidence/standalone-production.png) and
[non-React overlay](evidence/overlay-non-react.png). The separate eight-test Vite
product suite uses real data at desktop, 360px and 420px widths and retains real
asset/graph checks. It no longer asserts synthetic tree labels or annotation IDs.

The measured overlay is 268,889 raw / 84,138 gzip bytes, versus its old shell-only
229,100 / 72,417 bytes. Other client/extension bundles remain below their unchanged
limits. Root checks and unchanged 80% coverage gates pass; exact package coverage
is in the build report.

Earlier Firefox prototypes using a fixed port were excluded after discovering a
leftover diagnostic instance. Final Firefox captures assert exact disposable
profile identity on a unique port. Earlier negative diagnostic checks incorrectly
expected no native tab; corrected checks assert the actual visible non-React
state and no component values. Raw Firefox profile paths/process IDs are redacted.
Original owner `_screenshots/` are untouched and excluded from commits/artifacts.

## Reproduce

Build first, then run `node docs/recovery/r05/serve-fixture.mjs`. The fixture server
uses port 9054 and serves `/development`, `/production`, `/empty`, `/non-react`;
add `?overlay` for the actual floating host and separate-window workflow.

```sh
node docs/recovery/r05/verify-models.mjs /private/tmp/r05-hosts
node scripts/native-session-chrome.mjs http://127.0.0.1:9054/development /private/tmp/r05-chrome --models
node scripts/native-session-firefox.mjs http://127.0.0.1:9054/production /private/tmp/r05-firefox --models
```

`npm run test:model-smoke` owns its own fixture-server lifecycle; stop any existing
9054 fixture before running it. Native helpers use disposable profiles and select
actual registered native panels. Firefox uses a unique Marionette port and asserts
the exact profile identity, avoiding accidental attachment to another browser.
Firefox's remote panel text is inaccessible: native keyboard interaction, actual
inspection RPC responses and visually inspected screenshots jointly establish its
result. No fake replies, hook roots or inspectedWindow contexts are supplied.
