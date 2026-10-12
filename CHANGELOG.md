# Changelog

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
