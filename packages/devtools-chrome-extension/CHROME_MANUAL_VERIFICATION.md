# Chrome Extension Manual Verification

Tracking issue: P5-11 / #111.

## Unpacked Load Check

1. Run `npm run build --workspace @devtools/chrome-extension`.
2. Open Chrome to `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked" and select
   `packages/devtools-chrome-extension/dist`.
5. Confirm the extension appears as "React DevTools" with no manifest errors.
6. Open the extension details view and confirm:
    - Manifest version is 3.
    - The background service worker is `background.js`.
    - The DevTools page is `devtools.html`.
    - The only extension API permissions are `activeTab` and `scripting`.
    - Static content scripts are limited to `http://*/*` and `https://*/*`.

## Permission Policy

The extension requests `scripting` only so the DevTools panel can inject the
isolated-world RPC proxy after the panel opens. It still does not request `tabs`
or broad host permissions.

## Packaging

Run `npm run package --workspace @devtools/chrome-extension` to rebuild the
extension and write a versioned zip plus `.sha256` checksum to `dist/extensions`.

## Live Panel Walkthrough

Use `apps/playground` as the inspected React page.

1. Open DevTools on the playground page.
2. Confirm the "React" panel appears after React is detected.
3. Confirm the Components tab shows the live playground tree instead of the
   standalone fallback tree.
4. Select a component and confirm the detail pane updates with props, hooks, or
   state sections when available.
5. Hover or inspect a component and confirm the highlight appears over the
   matching DOM node in the inspected page.
6. Reload the inspected page and confirm the panel reconnects and refreshes the
   tree without stale state.
