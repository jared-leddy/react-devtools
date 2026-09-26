# Phase 5 Manual Verification

Date: 2026-09-26

Issue: P5-11 / #111

Builds under test:

- `@devtools/chrome-extension@0.0.14`
- `@devtools/firefox-extension@0.0.3`
- `@devtools/client@0.0.22`
- `@devtools/core@0.0.21`
- `@devtools/kit@0.0.17`
- `@devtools/playground@0.0.7`

## Environment

- Repository branch: `issue-111-phase5-manual-verification`
- Chrome browser: Google Chrome / Chromium for Testing driven by Playwright
- Firefox browser available locally: Firefox Developer Edition `157.0b4`
- React fixture surface: `apps/playground`
- Extension artifacts:
    - `dist/extensions/react-devtools-chrome-extension-v0.0.14.zip`
    - `dist/extensions/react-devtools-firefox-extension-v0.0.3.zip`

## Results

| Browser | Verification item                                  | Result                         | Evidence                                                                                                                                                                                                                                              |
| ------- | -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome  | Unpacked extension loads with no manifest errors   | Pass                           | `npm run test:e2e` loads `packages/devtools-chrome-extension/dist` through Playwright persistent Chromium.                                                                                                                                            |
| Chrome  | React smoke harness renders extension UI           | Pass                           | Playwright asserts the extension `smoke.html` page shows `React detected`, `DevTools panel is available.`, and the React root tree entries `App` and `SmokeFixture`.                                                                                  |
| Chrome  | Build and package artifacts are complete           | Pass                           | `npm run package --workspace @devtools/chrome-extension` writes the versioned zip and checksum; release packaging tests validate required Chrome dist entries.                                                                                        |
| Firefox | Temporary add-on manifest surface builds cleanly   | Pass                           | `npm run package --workspace @devtools/firefox-extension` writes the versioned zip and checksum; release packaging tests validate required Firefox dist entries.                                                                                      |
| Firefox | Firefox runtime available for temporary add-on UAT | Pass                           | Local Firefox Developer Edition reports `Mozilla Firefox 157.0b4`.                                                                                                                                                                                    |
| Firefox | Temporary add-on live panel walkthrough            | Pending manual browser handoff | Firefox extension panel automation is not wired into this repository yet; follow `packages/devtools-firefox-extension/FIREFOX_SMOKE_CHECKLIST.md` to load the temporary add-on and verify live tree, highlight, selection, and state viewer behavior. |

## Phase 5 UAT Checklist

Use `apps/playground` as the inspected React page for both browsers.

| Walkthrough item            | Expected result                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Load extension              | Browser accepts the extension with no manifest or permission errors.                               |
| Open DevTools on playground | The `React` panel appears after React is detected.                                                 |
| Inspect live tree           | Components tab shows the live app tree from the inspected page, not the standalone fallback tree.  |
| Select a component          | Detail pane updates to the selected component and shows props/hooks/state sections when available. |
| Highlight a component       | Hover/inspect highlight appears over the matching DOM node in the inspected page.                  |
| Reload inspected page       | The panel reconnects and refreshes the tree without stale component state.                         |

## Notes

- Chrome has automated smoke coverage for extension loading and the React smoke harness. Browser DevTools panel interaction remains covered by the manual checklist because Chrome extension DevTools pages are not fully scriptable through the current Playwright smoke.
- Firefox has build/package/manifest validation and a real local browser available, but temporary add-on panel interaction remains manual. A future Firefox Playwright or `web-ext` harness should promote that row from manual handoff to automated evidence.
