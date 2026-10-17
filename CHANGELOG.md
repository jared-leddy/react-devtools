# Changelog

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
