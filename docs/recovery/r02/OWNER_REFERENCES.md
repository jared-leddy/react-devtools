# Owner Reference Annotations

All 18 restored references were inspected on October 12, 2026. Their dimensions
and SHA-256 hashes are retained in [owner-reference-measurements.json](evidence/owner-reference-measurements.json).
Original images remain in the owner's `_screenshots` directory, unchanged and
untracked. They contain browser tabs/application context and are not redistributed
in the PR/release. File names below are exact local reference identifiers.

## Components Sheet

Primary reference: `vue/Screenshot 2026-10-10 at 01.16.18.png`, 1920 x 1080.
Coordinates are original raster pixels, not guessed CSS units. Content-only
comparison rectangle: x=0..1919, y=167..994 (1920 x 828); browser toolbar,
native DevTools tabs and OS dock are excluded. Coordinate bounds below are
inclusive unless stated otherwise.

| Mark               | Location / Measurement                              | Design Consequence                                                               |
| ------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| A: rail            | x=0..49, 50px                                       | Fixed narrow branded rail, no horizontal page-level navigation                   |
| B: tree            | Interior x=50..984, 935px                           | Flat pane; selection spans usable row width                                      |
| C: divider         | x=985, 1px; RGB 46,48,49 (`#2e3031`)                | Quiet pane separator; practical draggable hit area must exceed visible line      |
| D: inspector       | Interior x=986..1918, 933px                         | Independent value scroll; no second enclosing card                               |
| E: toolbar         | y=167..216, 50px band                               | Tree search and picker; selected name/state filter/actions aligned in other pane |
| F: tree input      | Approximately x=58..951, y=182..208, 27px inclusive | 8px tree gutter, compact input, no external filter-label row                     |
| G: row             | Selected Pages y=315..334, exactly 20px at x=600    | Stable dense virtualized row geometry; other selected rows similarly 20px        |
| H: selection       | x=600,y=325 RGB 65,159,105 (`#419f69`)              | Full-row green; screenshot sample wins over secondary-source `#299f69`           |
| I: base            | x=600,y=500 RGB 18,18,18 (`#121212`)                | Neutral near-black, not blue-black nested cards                                  |
| J: input border    | x=100,y=182 RGB 62,87,112 (`#3e5770`)               | Quiet distinct input boundary; final contrast/focus tested separately            |
| K: indent / font   | 15px per level and `text-3.5` from source           | 14px monospace proposal; exact installed font/zoom cannot be recovered from PNG  |
| L: bottom Settings | Separate rail footer near y=951..994                | Always reachable while middle tools scroll/overflow                              |

The source rail also specifies 50 CSS px, so 50px is the initial implementation
target, not the plan's earlier approximate 48px. This agreement does not prove
OS scale or browser zoom. The first `01.15.35` image is 1911 x 911 with content
starting y=84 and a visible 42px rail: treat it as a distinct crop, not a second
layout or proof of zoom. Never include browser chrome in screenshot comparisons.

## State-By-State Inventory

| Directory / Time    | Observed State                                                                | Required React Presentation                                                       |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Vue `01.15.35`      | nuxt-root selected; setup, provided, Routing; function and literal colors     | Root/component actual values; React categories, not Nuxt setup labels             |
| Vue `01.15.43`      | App selected; supplied context and route sections                             | Selection controls actual detail identity; sparse sections are valid              |
| Vue `01.15.50`      | NuxtPage selected; props including undefined/null; provided/Routing           | Typed unavailable/null values stay distinct; no fake default props                |
| Vue `01.15.59`      | RouterView selected; props; computed/context wrappers                         | Typed nested detail and provider capabilities                                     |
| Vue `01.16.09`      | RouteProvider selected; expandable vnode/route; key and inline suspense tag   | Real React wrapper/key/kind annotations only; no Vue-only synthetic tags          |
| Vue `01.16.18`      | Pages selected; reactive state, computed count, event warning and route       | Props/Hooks/State/Context, actual diagnostics; unavailable sections absent        |
| Vue `01.16.32`      | Current-route input above flat one-row All Routes table                       | Adapter-backed route count/table; URL edit only with navigation capability        |
| Vue `01.16.50`      | Performance layer selected, Not recording, No events                          | Separate recording/layer/event regions; only real React/plugin event sources      |
| Vue `01.16.58`      | Router sub-tabs, route search/selection and options detail                    | Adapter workspace with dense sub-tabs/typed route inspector                       |
| Vue `01.17.05`      | Centered Vue DevTools brand; three simple version/pages/components tiles      | React-focused brand and true summaries; no enclosing/nested dashboard cards       |
| Vue `01.17.32`      | Page highlight + Pages/dimensions label; centered instruction/Cancel          | Genuine DOM picker overlay and component selection; teardown independently tested |
| Official `01.22.38` | Short identifiers plus meaningful framework names, forwardRef badges          | Do not promise reconstruction of metadata removed by optimization                 |
| Official `01.22.57` | Page marked Server, params/searchParams Promise; canary renderer              | Honest client/server boundary and Promise typing; no invented server state        |
| Ours `01.24.01`     | Standalone/Connected, hard-coded version/root/12.4ms/Routes 4; nested cards   | Real host/handshake/runtime facts; remove fake values and nested dashboard        |
| Ours `01.24.21`     | ComponentGroup0/ComponentLeaf fixtures; duplicate name/ID/tags; large headers | Real app tree; compact monospace inspector and capability-backed actions          |
| Ours `01.24.31`     | Timeline placeholder inside a card                                            | Working recording/event workspace, not restyled placeholder                       |
| Ours `01.24.40`     | Settings with wide rows, persistent JSON textarea                             | Compact controls, theme picker/toggles, advanced export/import disclosure         |
| Ours `01.24.48`     | Command palette over Settings                                                 | Preserve functional palette as focus-managed transient tool, not a header button  |

## Additional Geometry And Limits

Timeline `01.16.50`: layer pane ends at x=704; selected layer is approximately
x=65..688, y=304..335. Event workspace fills remaining width, with a centered
No events state. Router detail `01.16.58` divides at x=798, not the Components
50:50 position: pane ratios can be workspace-specific and persisted.

Picker `01.17.32`: panel starts y=595 below native tabs; dialog approximately
x=720..1199, y=705..884 (480 x 180). Page label approximately x=0..141,
y=112..146 includes actual component name and dimensions. The instruction is a
temporary centered surface, not a permanent panel header. Reduce its dimensions
to fit short/narrow panels without blocking Cancel or overflowing content.

No original Vue Stores, Settings, popup, light theme, narrow pane, focus, keyboard
or error reference is supplied. Do not ask for invented "matching" baselines.
Derive those states from the shared approved grammar and the inspected upstream
state/Pinia/Settings sources, then request visual review during R19/R20/R22/R23.
Their missing images do not justify silently claiming parity. Still images cannot
prove drag, keyboard behavior, recording, animation, editing or picker teardown.
