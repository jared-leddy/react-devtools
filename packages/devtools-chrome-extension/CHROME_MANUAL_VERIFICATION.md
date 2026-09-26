# Chrome Extension Manual Verification

Tracking issue: P5-01 / #101.

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
    - The only extension API permission is `activeTab`.
    - Static content scripts are limited to `http://*/*` and `https://*/*`.

## Permission Policy

The scaffold intentionally does not request `scripting`, `tabs`, or broad host
permissions. Future issues should add those only with a targeted manifest test
and a short note explaining the new browser API requirement.
