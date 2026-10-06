---
title: Extension
---

# Extension

The browser extensions add a **React** panel to browser developer tools without
requiring changes to the application's Vite configuration. The Chrome build is
in `packages/devtools-chrome-extension`; the Firefox build is in
`packages/devtools-firefox-extension`.

## Choose A Build

| Browser | Minimum Version | Current Delivery                       |
| ------- | --------------- | -------------------------------------- |
| Chrome  | 102             | Manifest V3; local unpacked extension. |
| Firefox | 109.0           | Manifest V2; local temporary add-on.   |

This guide uses the repository's pre-release loading paths. No verified Chrome
Web Store or Mozilla Add-ons listing URL is configured in this documentation.
Use this project's [repository](https://github.com/jared-leddy/react-devtools)
and [releases](https://github.com/jared-leddy/react-devtools/releases) to identify
its builds; do not assume a similarly named store extension is this project.
A ZIP/checksum release artifact is not proof of store approval or Firefox signing.

## Build Locally

Clone the repository and build from its root so workspace dependencies, including
the client and shared UI, are built in dependency order:

```bash
git clone https://github.com/jared-leddy/react-devtools.git
cd react-devtools
npm install
npm run build
```

The browser-specific output directories contain `manifest.json`, scripts, and
HTML pages. Load the **dist** directory, not `src` or `public`: the source
manifest references files produced by the build.

To package versioned ZIPs and SHA-256 checksums after building:

```bash
npm run extensions:package -- --skip-build
```

Artifacts are written to `dist/extensions`; see
[Extension Release Packaging](./extension-release.md) for naming and submission
steps. Unzip a packaged Chrome artifact before using **Load unpacked**.

## Install In Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select `packages/devtools-chrome-extension/dist`.
4. Confirm **React DevTools** appears without manifest errors. Its manifest
   version is 3 and its background worker is `background.js`.
5. Open or reload an ordinary HTTP/HTTPS React application after installation.
6. Open Chrome developer tools on that application and select **React**. Check
   the overflow menu if the panel tab is hidden.

The toolbar popup is not the inspection panel. Use browser developer tools to
inspect components. Pin the extension through Chrome's extensions menu when you
want its toolbar detection signal visible.

After rebuilding, use **Reload** on the extension's `chrome://extensions` entry,
reload the inspected application, and close/reopen its developer tools. To remove
the local extension, choose **Remove** on that entry.

## Install In Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `packages/devtools-firefox-extension/dist/manifest.json`.
4. Confirm **React DevTools** loads without manifest errors. This build uses
   Manifest V2 and the development add-on ID `react-devtools@local.dev`.
5. Open or reload an ordinary HTTP/HTTPS React application after loading.
6. Open Firefox developer tools on that application and select **React**. Check
   the panel overflow menu if necessary.

Use **Reload** in `about:debugging` after rebuilding, then reload the application
and reopen developer tools. Temporary loading is a development path; reload the
temporary add-on after restarting Firefox. A permanent store installation needs
a separately signed/distributed add-on. Choose **Remove** in `about:debugging` to
unload the temporary build.

For repository contributors, this helper rebuilds the Firefox extension, checks
its output files, and opens the manual-verification pages:

```bash
npm run uat:firefox --workspace @devtools/firefox-extension
```

It uses the default macOS Firefox locations. Override the executable when needed:

```bash
FIREFOX_UAT_BROWSER=/path/to/firefox npm run uat:firefox --workspace @devtools/firefox-extension
```

## Inspect An Application

1. Load an application that mounts client-side React, then open its **React**
   developer-tools panel.
2. In **Overview**, confirm the renderer and root belong to the inspected page.
3. In **Components**, select a component and inspect the available props,
   hooks, state, and source metadata. Generic React state is read-only.
4. Trigger an application update and confirm the tree/details refresh.
5. Hover or inspect a component and confirm its DOM highlight appears on the
   inspected page when a corresponding DOM node is available.
6. Reload the page and confirm the panel reconnects without stale state.

Extension delivery does not install Vite middleware. Vite's asset/module-graph
RPC and `/__open-in-editor` endpoint require the
[Vite plugin](./vite-plugin.md). Custom-inspector registration also needs a
supported bridge; see the
[plugin transport limitations](../plugin-authoring/overview.md#transport-and-verification-limits).

## Permissions And Site Access

The source manifests request these extension API permissions:

| Permission  | Chrome | Firefox | Why It Is Requested                                                                                                                                                                                     |
| ----------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` | Yes    | Yes     | Grants temporary access associated with the user's interaction with the current tab, supporting inspection without a persistent host-permissions list.                                                  |
| `scripting` | Yes    | No      | Chrome's Manifest V3 panel uses `chrome.scripting.executeScript` to inject the isolated-world `proxy.js` bridge into the inspected tab. Firefox uses its Manifest V2 `tabs.executeScript` path instead. |

Neither manifest requests the `tabs` permission, optional permissions, or a
separate `host_permissions` list. Using a browser API under `tabs` does not mean
the manifest requests the `tabs` permission.

**Static content-script site access is separate from `activeTab`.** Both manifests
declare `http://*/*` and `https://*/*` matches with `all_frames: true` and
`run_at: 'document_start'`. The hook preparation/detection scripts can therefore
run automatically on matching pages and frames, subject to browser site-access
controls. The absence of a `host_permissions` key does not mean the extension
only runs after you click its toolbar icon. Review the browser's site-access
controls when deciding where to enable it; blocking access can prevent detection.

Browser-owned pages, extension pages, store pages, built-in PDF viewers, and
other privileged surfaces may refuse content scripts or inspected-window
evaluation even when their displayed URL resembles an HTTP/HTTPS URL. `file://`
is not declared by these content-script matches. Use a local HTTP dev server for
local files rather than relying on file-URL inspection.

## How The Bridge Loads

| Browser | Automatic Page Setup                                                                                                                | Panel Setup                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Chrome  | `prepare.js` and `detector.js` run in the `MAIN` world at document start in matching frames.                                        | Opening the panel injects `proxy.js` through `scripting` and loads `user-app.js` into the page context. |
| Firefox | Isolated-world `prepare-loader.js` inserts page-context `prepare.js` and `detector.js`; `proxy.js` is also a static content script. | Opening the panel bootstraps the proxy through `tabs.executeScript` and loads `user-app.js`.            |

Chrome uses a module background service worker. Firefox uses a nonpersistent
Manifest V2 background script. Each relays page/panel messages by inspected tab;
navigation clears its detection/port state.

The manifests expose these **web-accessible resources**, which are not additional
extension API permissions:

- Chrome: `smoke.html` and `user-app.js`, with resource matches `<all_urls>`.
  This resource scope is broader than the HTTP/HTTPS content-script matches;
  it allows page access to those bundled resources, not automatic injection on
  every scheme.
- Firefox: `detector.js`, `prepare.js`, `smoke.html`, and `user-app.js`, using the
  Manifest V2 resource-list form. The page loader needs access to the preparation
  and detection scripts; the panel needs the application bridge. `smoke.html`
  is the bundled verification fixture.

Both extension-page CSPs restrict scripts, styles, frames, child contexts, and
connections to extension-owned resources, block objects, and prohibit inline
scripts/styles and eval. Chrome additionally declares `frame-ancestors 'none'`;
the Firefox manifest does not. These policies apply to extension pages, not to
every inspected application's own policy. A page's CSP can still block
page-context script loading, particularly Firefox's loader or `user-app.js`.

## Detection Signals And Current Limits

The background updates the toolbar badge/title when a detection message arrives.
It resets that state on navigation. Panel creation checks the inspected top-level
window's React hook for renderers, polling up to 20 times at 250 ms intervals.
If React mounts much later, reopen developer tools after it has mounted to
restart panel detection. Although content scripts run in all matching frames,
that does not guarantee a panel for a page whose React renderer exists only
inside an iframe: the current panel-creation check targets the top-level window.

The popup components contain detected, unsupported, and not-detected views, but
the current popup entry points render `createDefaultPopupStatus()` without
subscribing to live background state. They can keep showing **Checking for React**
and the placeholder version `0.0.0` even when detection succeeded. Popup docs
buttons also have no opener wired in the current entry points. Use the toolbar
signal and the live **React** panel to verify connection, and use this site's
navigation for documentation. Find the installed build version in the browser's
extension details or the built manifest.

## Troubleshooting

| Symptom                                   | Checks And Recovery                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extension will not load                   | Check the minimum browser version and load the built `dist` folder/manifest. Build from the repository root so dependencies exist. Read manifest/build errors in the browser's extension management page.                      |
| React panel is missing                    | Reload the application after extension installation, confirm React has mounted, and close/reopen developer tools to restart detection. Check overflow tabs, extension site access, and whether React exists only in an iframe. |
| Toolbar or popup seems stale              | Navigation clears detection state; reload and allow the detector to run again. The current popup is not a live status source, so inspect the panel and extension details instead.                                              |
| Panel loads but no live components appear | Confirm the page has a client-side React root. Check inspected-page console errors for blocked `user-app.js`, bridge failures, or hook conflicts. Reopen developer tools and reload the app.                                   |
| A restricted page is not inspected        | Switch to an ordinary HTTP/HTTPS app page. Browser-owned/store/PDF surfaces may be blocked by the browser; broadening permissions is not a troubleshooting step.                                                               |
| Firefox works until browser restart       | Load the temporary add-on again through `about:debugging`. Permanent installation/signing is a separate distribution path.                                                                                                     |
| Changes are not visible after rebuilding  | Reload the extension/add-on, reload the inspected page, and reopen developer tools. Existing tabs do not automatically receive newly built scripts.                                                                            |
| Source or editor actions are unavailable  | Production builds may omit source metadata. Extension delivery alone does not provide Vite's editor endpoint; use Vite delivery when those capabilities are required.                                                          |
| Official React DevTools also installed    | The hook is designed for coexistence. Reload with both enabled and follow [hook conflict troubleshooting](../troubleshooting.md#official-react-devtools-hook-conflict).                                                        |

When reporting a problem, include browser/version, extension manifest version,
page URL scheme, React version, reproduction steps, and relevant console/extension
errors. Redact application data before attaching component snapshots. See
[extension CSP and permissions troubleshooting](../troubleshooting.md#extension-csp-and-permissions)
for additional diagnostics.
