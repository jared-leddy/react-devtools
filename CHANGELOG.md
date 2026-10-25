# Changelog

## 0.1.13

- Inspect committed props, nested hook slots, reducer values, class state and
  observed context in separate read-only sections, fetched only on demand.
- Preserve typed values and show explicit unavailable/truncated markers. Bound
  collection, depth, string and total expansion; skip property accessors.
- Stop treating class state as hook lists or guessing production reducer kinds.
  Keep raw context values out of pushed component-tree metadata.
- Add development/production value fixtures, web-host CI scenarios and real native
  Chrome/Firefox inspection evidence. Development builds: Chrome 0.0.21,
  Firefox 0.0.12; not approved browser-store releases.

## 0.1.12

- Give components opaque root-scoped identities that survive alternate Fibers,
  keyed reordering and display-name changes. Retire identities on unmount.
- Preserve available wrapper names and tags, source locations and React keys;
  retain truthful minified or anonymous labels when richer metadata is absent.
- Resolve inspection and highlighting through the same root-scoped Fiber map,
  keeping DOM lookup inside the selected subtree. Include observed DOM bounds
  in on-demand inspection replies.
- Add real development and production identity regressions across overlay and
  standalone hosts, plus native extension diagnostics. Development artifacts:
  Chrome 0.0.20 and Firefox 0.0.11; browser-store readiness remains separate work.

## 0.1.11

- Replace production demo components and parent-DOM tree polling with real,
  session-backed component models. Keep synthetic trees in tests only.
- Show selected components' observed props and hook values on demand, with
  revision/selection guards against stale replies and honest failure states.
- Share the page backend across native extensions, overlay and isolated
  standalone windows. Exclude the overlay's own root/renderer from app facts.
- Install the overlay hook before the app's React bundle; remove fabricated
  renderer/version/root/timing facts and panel-derived app route counts.
- Add unannotated development/minified-production/empty/non-React host checks,
  production-output guards and native Chrome/Firefox inspector evidence.
- Raise only the overlay payload budget to account for its real page backend;
  unit coverage gates remain unchanged. Development extension artifacts:
  Chrome 0.0.19 and Firefox 0.0.10, not approved browser-store releases.

## 0.1.10

- Add protocol-v2 session/stream identities, atomic revisions, coalesced updates,
  snapshot reconciliation and revision-only heartbeats for missed final updates.
- Stop page producers and queued work when native DevTools closes; rehydrate a
  fresh stream when a new session opens. Retain legacy direct RPC compatibility
  without advertising an invented versioned stream.
- Preserve renderer/root metadata and observed commit counts; distinguish child
  removal from real root unmount and do not reuse root IDs within an active stream.
- Invalidate component caches on commits and inspect values on demand instead of
  collecting every component value on each commit. Inspector UI remains R05/R06.
- Add native live-update/disconnect/reopen evidence and real compiled transport
  regression tests. Coverage gates and bundle budgets remain unchanged.
- Fix Firefox's fast-page hook startup race with native MAIN-world injection;
  Firefox 128 or newer is now required.
- Development artifacts: Chrome 0.0.18 and Firefox 0.0.9. Not store-approved builds.

## 0.1.9

- Add versioned, backend-confirmed sessions, explicit capabilities, subscriptions
  and disposal; connect native Chrome/Firefox panels to the client provider.
- Render actual renderer/root metadata and honest handshake failure states.
  Component inspection remains explicitly unavailable in session-backed panels
  until the recovery inspection work is complete.
- Fix native Chrome framing, classic content-script isolation, Firefox script
  delivery, document-start proxy injection and the navigation relay startup race.
- Add typed embedding examples, StrictMode/disposal/failure tests and classic
  script build coverage. Existing coverage and bundle gates remain unchanged.
- Development builds: Chrome 0.0.17, Firefox 0.0.8. These are unpacked/temporary
  extension artifacts, not approved browser-store releases or a finished UI.
