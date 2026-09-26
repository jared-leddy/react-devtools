# Firefox Extension Smoke Checklist

Tracking issue: P5-11 / #111.

## Manifest Differences From Chrome

- Firefox uses Manifest V2 for this first verified loading path because Firefox does not provide full parity with Chrome's MV3 extension service worker model.
- `browser_action` replaces Chrome MV3 `action`.
- `background.scripts` with `persistent: false` replaces Chrome MV3 `background.service_worker`.
- `browser_specific_settings.gecko` declares the development add-on ID and minimum Firefox version.
- Content scripts omit Chrome's `world` property. Firefox loads an isolated-world `prepare-loader.js` content script that injects the shared `prepare.js` and `detector.js` page-context scripts from `web_accessible_resources`.
- `web_accessible_resources` uses the Firefox MV2 array form for `prepare.js`, `detector.js`, `user-app.js`, and `smoke.html`.

## Local Build Smoke

1. Run `npm run build --workspace @devtools/firefox-extension`.
2. Run `npm run package --workspace @devtools/firefox-extension`.
3. Confirm `dist/manifest.json`, `dist/background.js`, `dist/devtools.html`, `dist/devtools.js`, `dist/devtools-panel.html`, `dist/devtoolsPanel.js`, `dist/popup.html`, `dist/popup.js`, `dist/prepare-loader.js`, `dist/prepare.js`, `dist/detector.js`, `dist/proxy.js`, `dist/user-app.js`, `dist/smoke.html`, and `dist/smoke.js` exist.
4. Confirm `dist/extensions/react-devtools-firefox-extension-v0.0.3.zip` and its `.sha256` checksum were written.
5. Open Firefox to `about:debugging#/runtime/this-firefox`.
6. Choose "Load Temporary Add-on" and select `packages/devtools-firefox-extension/dist/manifest.json`.
7. Open a React playground page.
8. Confirm the extension popup loads and changes to the React-detected state after the page hook detector runs.
9. Open Firefox DevTools and confirm the "React" panel appears.
10. Confirm the panel mounts the rebuilt client and shows the live React tree for the inspected page.
11. Select a component and confirm the detail pane updates with props, hooks, or state sections when available.
12. Hover or inspect a component and confirm the highlight appears over the matching DOM node in the inspected page.
13. Reload the inspected page and confirm the panel reconnects and refreshes the tree without stale state.

## Known Follow-Up Tracking

- Automated Firefox extension panel testing is not wired into Playwright in this repository yet.
- Signed AMO publishing remains separate from the local temporary add-on and zip packaging path.
