# R08: Browser session lifecycles

Issue: [#253](https://github.com/jared-leddy/react-devtools/issues/253).

## Contract

The native panel inspects its actual `inspectedWindow.tabId` and the top document.
Frame ports cannot replace that document's port, and window bridges require the
message's real `source` to be their own window. Child-frame inspection is not
offered by this release; child React trees must never be presented as the top
document. Toolbar detection follows the same frame boundary. This is an isolation
rule, not a claim that the panel has a frame selector.

Only the current page/panel port pair can relay a message. Replaced documents and
closed tabs cannot deliver through retained port references. A second simultaneous
panel port is rejected rather than allowing two clients to fight over one page
producer. Closing/reopening the actual DevTools toolbox creates a fresh panel
connection. Background-worker loss reconnects both sides of the bridge.

Extension sessions retry through a fresh RPC client and handshake after a physical
disconnect or timeout. The previous stream's roots, selections and inspected
values are removed immediately; late replies cannot resurrect them. Generic
sessions retain opt-in retry via `reconnectMs`; extension sessions default to one
second. Invalid delays are rejected. Heartbeat checks still detect missing final
updates. Offline traffic is bounded to 64 messages per channel, and physical
disconnect drops the previous queue. Disposal cancels owned reconnect timers and
removes message/disconnect listeners.

The user-app backend now bootstraps through the existing document-start MAIN-world
content scripts, after hook preparation. It remains passive until a panel
handshakes. A document-owned singleton prevents duplicate servers and hook
subscriptions when panel injection or reinjection also occurs. Teardown releases
the singleton, and persisted page restoration can acquire it again. Singleton
reuse requires the native transport's explicit key; independently owned overlay
and standalone channels in the same document keep separate backends. The content
relay likewise owns one window listener and restores its port without installing
another listener on every worker reconnect. The panel unregisters its navigation
listener and unmounts its session on unload. Extension pages do not match the
inspected-page content-script URLs, so they are not inspected as app roots.

## Actual-browser verification

The fixture uses real Vite and React Fast Refresh. Updating its private temporary
`App.tsx` through a test-only localhost endpoint exercises the real file watcher,
module replacement, React commit and native inspection path. There are two real
tabs and a child React iframe; no overlay, substitute panel, fabricated RPC reply
or replacement `inspectedWindow` supplies the observations.

After building, `npm run test:lifecycle-smoke` owns the Vite fixture server on
port 9057 and launches the native Chrome diagnostic. On Linux CI it uses the
installed Playwright Chromium executable under `xvfb-run`; on macOS the default
is installed Google Chrome. `CHROME_EXECUTABLE_PATH` can select a different real
Chromium executable. CI uploads the native screenshots and diagnostics.

For separate manual/native Firefox evidence:

```sh
node docs/recovery/r08/serve-fixture.mjs
node scripts/native-session-firefox.mjs 'http://127.0.0.1:9057/?name=A' /private/tmp/r08-firefox --lifecycles
```

Chrome covers early opening before the app root mounts, two native panels bound
to different tabs, child-frame isolation, actual Fast Refresh with stable component
identity/state, three reloads with deliberately invalidated old selections, actual
service-worker stopped/running events, root unmount/remount, browser-denied
inspection of a restricted document, history recovery and inspected-tab closure
while the other tab remains live. Worker verification uses browser lifecycle
events; a stable debugger target ID does not imply the execution stayed alive.

Firefox covers late opening, real Fast Refresh, automatic reload recovery in the
same panel browsing context, stopped publications while DevTools is closed, and
actual toolbox reopening into a different panel context with fresh identities and
the current app state. Its MV2 event page is not represented as an MV3 worker test.
Unit tests additionally count delivery/listener ownership over repeated reconnects,
check retired ports and foreign windows, cancel retry timers and verify one backend
per document. BFCache eligibility is browser-dependent; restoration code is covered
without claiming every navigation uses BFCache.

All required gates retain their thresholds: formatting, ESLint, typechecks, global
80% unit coverage, packaging/helper/transport guards, builds, bundle budgets,
product smoke and all existing model/identity/value matrices. No bundle or coverage
limit is increased for this issue. Versions: workspace 0.1.14, core 0.0.27,
kit 0.0.24, overlay 0.0.14, Chrome 0.0.22 and Firefox 0.0.13. These are development
artifacts, not approved browser-store releases or a Vue-style visual-parity claim.

Final commit/build, browser versions, actual results, screenshots, coverage and
archive checksums are recorded under `evidence/` for delivery.

## Delivery evidence

Application source: `8afe6b54d6c6c8839ee65a1ce0b09b4b1f8cec2d`.
Verification head: `c5fab69ce3a92aaa8bb40effac7af8e9f687b96b`; subsequent changes
adjust only diagnostic startup paths and observe actual app commits during Firefox
reload negotiation. [Build provenance, coverage, versions and archive hashes](evidence/build.json)
identify the delivered application.

[Chrome's native lifecycle report](evidence/chrome.json) records distinct tab IDs,
isolated markers, stable HMR identity, three fresh reload snapshots, actual worker
stopped/starting/running events, root removal, a real browser permission denial,
history recovery and continued live data in the other tab after closure.
[Firefox's report](evidence/firefox.json) records panel context 19 surviving reload
and context 24 after actual toolbox reopening. It checks current state against real
commits rather than assuming a fixed startup delay. Installed versions were Chrome
155.0.8059.85 and Firefox 159.0, with React 19.1.1 and real Vite Fast Refresh.

Unedited captures: [Chrome recovered panel](evidence/chrome-recovered.png) and
[Firefox reopened panel](evidence/firefox-recovered.png). Raw reports retain expected
errors from Chrome's spare `about:blank` tab; that tab never supplies the fixture
panel's data. Profile/process fields are redacted from the Firefox report.

All required local gates pass, including 168 core tests, 79 kit tests, eight product
smoke tests, existing model/identity/value matrices and the new native Chrome
lifecycle command. The native evidence does not rely on overlay screenshots or
mocked RPC as proof of extension behavior. Coverage and payload limits remain
unchanged. [SHA256SUMS](evidence/SHA256SUMS) records evidence integrity.
