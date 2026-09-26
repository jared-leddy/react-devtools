# Firefox Extension Smoke Checklist

Tracking issue: P5-A05 / #32.

## Manifest Differences From Chrome

- Firefox uses Manifest V2 for this first verified loading path because Firefox does not provide full parity with Chrome's MV3 extension service worker model.
- `browser_action` replaces Chrome MV3 `action`.
- `background.scripts` with `persistent: false` replaces Chrome MV3 `background.service_worker`.
- `browser_specific_settings.gecko` declares the development add-on ID and minimum Firefox version.
- Content scripts omit Chrome's `world` property. The page-context bridge must be implemented through a Firefox-compatible injection strategy before the extension can claim full MAIN-world parity.
- `web_accessible_resources` uses the Firefox MV2 array form.

## Local Build Smoke

1. Run `npm run build --workspace @devtools/firefox-extension`.
2. Confirm `dist/manifest.json`, `dist/background.js`, `dist/devtools.html`, `dist/devtools.js`, `dist/popup.html`, `dist/popup.js`, `dist/prepare.js`, and `dist/proxy.js` exist.
3. Open Firefox to `about:debugging#/runtime/this-firefox`.
4. Choose "Load Temporary Add-on" and select `packages/devtools-firefox-extension/dist/manifest.json`.
5. Open a React playground page.
6. Confirm the extension popup loads and shows either a React detection state or the pending detector state.
7. Open Firefox DevTools and confirm the "React" panel appears.
8. Confirm the panel bootstrap event is emitted by `devtools.js`.

## Known Follow-Up Tracking

- Firefox MAIN-world page injection is not equivalent to Chrome's `world: "MAIN"` content script option yet.
- Automated Firefox extension panel testing is not wired into Playwright in this repository yet.
- Release packaging should include Firefox-specific validation before publishing signed add-ons.
