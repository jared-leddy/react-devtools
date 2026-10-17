# R04: Ordered, Recoverable Backend Updates

Issue: [#249](https://github.com/jared-leddy/react-devtools/issues/249).

## Contract

Protocol version 2 requires a session nonce, producer stream identity and revision
on snapshots and notifications. `clientId` is a display/host alias; every
`createDevToolsSession` instance gets its own `sessionId`, including instances
with the same alias. A stream changes when its producer reactivates. A new session
is required after disconnect; automatic reconnection/navigation UX remains R08.

The publisher subscribes before taking the activation snapshot. It merges changed
fields over a bounded 16ms window, stamps recipients atomically, and sends
`baseRevision`/`revision` with each patch. Revisions count store changes, not React
commits. Cached component values are invalidated by ID, not copied on every commit.
The generic core server owns publisher/transport cleanup; bare legacy function
factories retain protocol-v1 direct RPC compatibility but cannot claim a v2 stream
without a real update publisher.

The client buffers up to 64 pre-snapshot/pending updates, rejects foreign streams,
old sessions, duplicates and stale revisions, and applies only matching baselines.
A gap/overlapping batch fetches a fresh snapshot. A revision-only heartbeat every
second recovers even a dropped final notification with no subsequent app commit.
Only a newer snapshot can replace accepted state; malformed, stuck or
non-progressing recovery fails closed. Handshake attempts are bounded at 600ms
within the default five-second deadline; snapshot/revision requests use that
five-second request budget. Requests, queues and timers are closed on disposal.

## Native Producer

Final native verification exposed a pre-existing Firefox startup race: dynamically
inserting an external hook script could miss a fast parser-blocking React bundle.
Firefox now installs `prepare.js` before `detector.js` directly in MAIN world at
`document_start`; the proxy remains isolated. The declared minimum is Firefox 128,
matching [Mozilla's MAIN-world support](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/).
The older script-tag loader remains a tested build utility, not the shipped hook
entrypoint. No fixture delays or synthetic hook data mask the race.

Both native extensions share the inspected-page implementation. It subscribes to
hook events only while a versioned session is active, coalesces tree refreshes,
retains renderer links/commit counters through post-commit refreshes and removes
roots only on actual root unmount. Child removal does not delete its root.
Root IDs are not reused within an active registry; selection is cleared when its
root disappears or a fresh stream activates.

Props/hooks/context inspection is now on demand. Native stream payloads contain
transport-safe tree metadata, root/renderers and invalidations, not eagerly
collected component values. Raw context/error values are excluded from tree
notifications. Initial snapshot/root metadata and observed commit counts are
visible in Overview; counts are observed since producer activation, not lifetime
totals or timings. Native inspector capabilities remain disabled until R05/R06.

The background forwards actual native panel disconnects through the isolated
proxy to the page channel. The publisher cancels its pending batch and removes
hook/store listeners, releasing retained Fiber/value references while preserving
the last plain root metadata. A later session resynchronizes from the current hook.
Pagehide disposes the page server. The read-only overlay relay borrows a host
session and uses an independent revisioned stream without acquiring host ownership
or adding a DOM-derived component authority.

## Tests And Release

Focused tests cover snapshot/update races, stale replies, duplicates, gaps,
overlapping batches, final-update loss, malformed identities, queue overflow,
disposal, reused aliases, reentrant publication, burst coalescing, root metadata,
child/root unmounts, and lazy value reads. Compiled transport integration tests
hold/drop real Birpc/SuperJSON frames and structured-clone the wire payloads.
`npm run test:session-integration` runs those checks in CI alongside the unchanged
80% global Jest coverage gates and existing Node coverage guards.

All required root checks are run before delivery. Bundle budgets are unchanged;
the read-only relay intentionally avoids bundling the full server/state facade.
The legacy default overlay/standalone path is still an R05 migration, not a claimed
live Fiber integration. The Vue-style UI, full inspector, stores, official DevTools
coexistence and normal browser-store distribution are not completed by this issue.

Versions: workspace 0.1.10, core 0.0.23, kit 0.0.22, client 0.0.31,
overlay 0.0.10, Chrome 0.0.18, Firefox 0.0.9. This is a development release only.

## Native Evidence

Fresh release-build observations, exact source/build hashes and unedited images
are recorded after the final checks. The prototype checks already established
actual native updates and producer shutdown in both browsers; final evidence is
captured from the committed versioned build, not substituted from those prototypes.
Original owner screenshots remain untouched and excluded from commits/artifacts.

## Reproduce

Build first, then start `node docs/recovery/r04/serve-fixture.mjs`. In a separate
terminal run these macOS native diagnostic helpers:

```sh
node scripts/native-session-chrome.mjs http://127.0.0.1:9053/react /private/tmp/r04-chrome --updates
node scripts/native-session-firefox.mjs http://127.0.0.1:9053/react /private/tmp/r04-firefox --updates
```

The helpers install actual unpacked/temporary extensions into disposable browser
profiles and select their registered native panels. `--updates` clicks the real
fixture controls, observes native panel metadata/images, mounts/removes/remounts
a root, closes native DevTools and verifies no further outbound updates after app
commits. Firefox also reopens its native toolbox and verifies a fresh stream.
Passive page listeners record only actual RPC metadata/roots; no fake reply,
inspectedWindow context or component authority is installed. The fixture uses no
DOM component annotations.

These helpers need installed macOS Chrome/Firefox Developer Edition, GUI permission
and free CDP/Marionette ports 9351/2829. Firefox's current runtime requires
`MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`; the launcher sets it only for its disposable
test process. Native internal DevTools APIs are browser-version-specific. Firefox
remote panel text is not synchronously accessible, so actual context identities,
traffic and visually inspected native screenshots jointly establish its result.
These diagnostics do not replace R29/R30's durable native CI/release gates.
