# Phase 4 Manual Verification

Date: 2026-09-24

Issue: P4-08 / #100

Builds under test:

- `@devtools/vite-plugin@0.0.8`
- `@devtools/client@0.0.20`
- `@devtools/devtools-overlay@0.0.4`
- `@devtools/vite-playground@0.0.3`

Environment:

- Vite playground served at `http://localhost:9021/` because `9020` was already occupied locally.
- Browser: headless Google Chrome driven through the Chrome DevTools Protocol.
- Screenshot evidence: `/private/tmp/react-devtools-phase4-uat.png`

| Verification item                | Result | Evidence                                                                                                                                                                                       |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Floating toggle appears          | Pass   | `[aria-label="Toggle React DevTools panel"]` rendered after page load.                                                                                                                         |
| Iframe panel loads               | Pass   | Overlay iframe became visible and loaded the standalone client document.                                                                                                                       |
| Live component tree matches page | Pass   | Components tab rendered a 46-node live tree from parent document annotations, including `h1: React DevTools Vite Playground`, `Plain React fixtures`, `useState component`, and `state-count`. |
| Node selection renders details   | Pass   | Selected node details rendered source metadata, test id, text, and hook/source fields.                                                                                                         |
| Hover inspect highlight appears  | Pass   | Inspect mode rendered `[data-testid="react-devtools-inspect-box"]` over the inspected Vite page element.                                                                                       |
| Chrome console errors            | Pass   | CDP run reported `consoleProblems: []` and `logProblems: []`.                                                                                                                                  |

Notes:

- The manual pass uncovered and fixed three delivery blockers: TypeScript generic syntax was being annotated as JSX, Vite static asset requests could fall through to the app HTML fallback, and the overlay IIFE bundle referenced `process.env.NODE_ENV` at runtime.
- The Components panel now uses the live same-origin parent document annotations when opened through the Vite overlay iframe, with the synthetic tree retained as the standalone fallback.

## P4-A06 / #25 Component Inspector Verification

Builds under test:

- `@devtools/vite-plugin@0.0.10`
- `@devtools/client@0.0.22`
- `@devtools/devtools-overlay@0.0.4`

Automated coverage:

- Vite transform tests assert default JSX annotations include source metadata, stable `data-react-devtools-component-id`, and `data-react-devtools-display-name`.
- Vite transform tests assert `componentInspector: false` and `sourceMetadata: false` can be used independently.
- Client tests assert the overlay iframe can receive `react-devtools:inspect-target` messages and select the matching live parent document component.

Manual checklist:

| Verification item                    | Expected result                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Open Vite playground overlay         | Components tab shows live parent document nodes using component display names when available.    |
| Toggle inspect mode and click a node | Client navigates to `/components?componentId=...` and selects the clicked annotated React node.  |
| Open selected source                 | Component details exposes the annotated source and the Open in editor action uses that location. |
| Disable component inspector          | `reactDevtools({ componentInspector: false })` keeps source metadata without component IDs.      |
| Disable source metadata              | `reactDevtools({ sourceMetadata: false })` keeps component IDs/display names for selection.      |
