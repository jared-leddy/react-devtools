# R09 — Real page actions

Issue: [#254](https://github.com/jared-leddy/react-devtools/issues/254).

The overlay toolbar and Components panel send actions to the same owned backend.
The Components panel sends typed session actions to the inspected document. A
picker resolves nested DOM targets against the current root registry and selects
the nearest surfaced owner component, with a host-row fallback for host-only
roots. It does not require DOM annotations or invent component identities.

Picking clears the tree filter, expands selected ancestors and reveals the real
row and inspector. A selection token also supports picking the same component
again. Tree hover highlights and scroll-to-component use the same current Fiber
map. Browser extensions open reported source locations through native DevTools
resource APIs, using zero-based line numbers; source buttons are absent when
metadata or host support is missing. Action failures are visible in the panel.

The picker skips its own overlay controls and client iframe, so users can cancel
from either surface. Closing or minimizing the overlay also cancels picking.

Capture listeners suppress application pointer/click handlers while picking and
are removed on selection, Escape, panel cancellation, route exit, page lifecycle
teardown and disconnect. Highlight cleanup checks its backend owner. Borrowed
session relays forward only available actions and release their owned work.

The product regression suite exposed inspection starvation during the fixture's
100 ms unrelated store commits. Selected reads now run serially, coalesce pending
revisions and retain each observed response until its replacement arrives.
Selection, stream, disconnect and disposal guards still reject obsolete replies.
This displays observed committed values rather than claiming an atomic snapshot
of an application that continues updating.

## Supported targets and limits

- Main-document targets, ordinary portals, and portals owned by a top-document
  React root into accessible same-origin frames are supported.
- Independent child-frame React roots and cross-origin frame inspection remain
  unavailable; R08 top-document transport isolation is preserved. The picker
  does not manufacture a frame selection. Frames present when picking starts and
  their subsequent load events are covered; newly inserted iframe elements
  require restarting the picker.
- A missing/inaccessible document or blocked overlay positioning produces an
  explicit picker error and rolls back listeners and overlay elements. Style
  policy failure is covered by a focused failure-injection test; this is not a
  claim of testing every CSP configuration.
- React 19 fixtures here expose no reliable component source location, so native
  evidence verifies that source controls stay absent. Adapter unit tests verify
  the native resource API and line conversion when metadata exists. No source
  location is synthesized and extension mode uses no Vite editor endpoint.
- These are functional inspector changes. Vue visual parity, store approval and
  browser-store distribution are separate recovery issues.

## Reproduction

Use the pinned repository Node/npm environment, install dependencies, and build:

```sh
npm run build
npm run test:picker-smoke
```

The smoke wrapper owns its local fixture server and a disposable native Chromium
profile. On Linux, run under `xvfb-run --auto-servernum`; optionally set
`CHROME_EXECUTABLE_PATH`. It opens the actual registered extension panel for the
inspected tab, rather than loading an extension HTML page as a regular tab.

For native Firefox (the existing diagnostic expects macOS Developer Edition):

```sh
node docs/recovery/r09/serve-fixture.mjs
node scripts/native-session-firefox.mjs http://127.0.0.1:9058/development /private/tmp/r09-firefox --picker
```

The fixture is an ordinary React application with nested targets, a portal, an
owned same-origin frame portal, an inaccessible cross-origin frame and a long
page for scrolling. It contains no component identity/source annotations. Both
development and minified production bundles are served.

## Bundle review

The overlay raw allowance increases from 280,000 to 282,000 bytes (0.72%) for
the real toolbar/backend bridge, owner cleanup and picker self-exclusion. No new
framework, icon dependency, browser permission or extension allowance is added;
the gzip allowance remains 90,000 bytes. This is an explicit functional-cost
change, not a baseline reset. Exact final measurements are in the evidence.

## Delivery evidence

The evidence manifest records the application source commit, exact tested build
hashes, browser/runtime versions, observed checks and archive hashes. Native
screenshots are unedited. `evidence/SHA256SUMS` verifies the committed evidence.
Raw profiles and process paths are excluded. See `evidence/build.json` and the
browser-specific JSON captures for the completed validation record.
