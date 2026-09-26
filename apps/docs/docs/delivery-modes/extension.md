---
title: Extension
---

# Extension

The browser extension build lives in `packages/devtools-chrome-extension`.
It ships as a Manifest V3 extension and keeps its default permission surface
small while the React bridge is built out.

## Permissions

The Chrome manifest declares `activeTab` as its only extension API permission.
It does not declare persistent `host_permissions`.

The extension uses static content scripts on ordinary web pages only:

- `http://*/*`
- `https://*/*`

It intentionally does not match `file://`, `chrome://`, browser Web Store
pages, extension pages, PDF viewer tabs, or other privileged/custom browser
surfaces. Those pages should show a disabled or unsupported popup state instead
of attempting script injection.

## Content Scripts

The manifest separates the two execution worlds used by the bridge:

- `prepare.js` runs at `document_start` in the `MAIN` world.
- `proxy.js` runs at `document_start` in the `ISOLATED` world.

Both scripts run in all HTTP/HTTPS frames so iframe-based React apps can be
detected without adding broader host permissions.

## Content Security Policy

Extension pages use a self-contained CSP:

- Scripts, styles, frames, child contexts, and connections are limited to
  extension-owned resources.
- Objects are blocked with `object-src 'none'`.
- Remote HTTP/HTTPS code, inline script, inline style, and eval are not allowed.
- `frame-ancestors 'none'` prevents the popup or DevTools pages from being
  embedded by another page.

If a future panel feature needs to connect to a local development server or
load a non-extension frame, that feature must add a focused manifest change and
document the reason.
