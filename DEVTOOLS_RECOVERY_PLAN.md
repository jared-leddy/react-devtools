# React DevTools Recovery And Browser Release Plan

Date: 2026-10-10

Status: owner-approved implementation backlog, not a claim of release readiness.

GitHub tracking: [Recovery issue index](RECOVERY_ISSUES.md). The index maps all
38 recovery items to their issues, milestones, and completion dependencies.

## Outcome

Build a React developer tool with the visual quality and interaction model of
the Vue DevTools screenshots in `_screenshots/vue`, backed by the inspected
application's actual components, props, state, contexts, and registered stores.
Ship tested Chrome and Firefox extensions that ordinary users can install.

This is a product recovery, not a theme change. Previous completed issues and
green CI do not establish that the extension works or meets this design target.
Do not advertise the existing builds as ready for general use. Keep them clearly
identified as experimental until the gates below pass.

The acceptance standard is **Vue-style presentation, React-correct semantics,
and proof from the installed extension**. Neither fabricated data nor an
attractive standalone mockup can satisfy it.

## Evidence Reviewed

All 18 supplied screenshots were inspected: 11 Vue, two official React, and five
of our extension. Code findings below were checked in this checkout. No new
live-browser or coexistence verification was performed while writing this plan.

| Evidence                                                             | Finding                                                                                                                                                                                     | Consequence                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Vue `01.15.35` through `01.16.18`                                    | Narrow branded rail; flat split panes; compact monospace tree and state; full-width green selection; tiny inline metadata and action icons.                                                 | These screenshots are the Components design specification, not vague inspiration.                                                       |
| Vue `01.16.32`, `01.16.58`                                           | Actual application routes, both summary and inspector views.                                                                                                                                | Distinguish app routes from the panel's navigation routes.                                                                              |
| Vue `01.16.50`                                                       | Timeline layer list, recording tools, selected layer, honest empty event pane.                                                                                                              | Replace the placeholder with a real recording workflow.                                                                                 |
| Vue `01.17.05`                                                       | Branded, unframed overview with compact runtime summaries.                                                                                                                                  | Preserve brand identity without adding a dashboard of nested cards.                                                                     |
| Vue `01.17.32`                                                       | Picker instruction, cancel action, page highlight and component/dimensions label.                                                                                                           | Match this complete interaction, including teardown.                                                                                    |
| Our `01.24.21`; `devtools-client/src/App.tsx`                        | `ComponentGroup0` and synthetic state appear because an empty parent-DOM tree falls back to `generateSyntheticComponentTree()`.                                                             | This is invented content, not a component naming problem caused by minification.                                                        |
| Both extension `src/devtools-panel.ts` files; client `src/mount.tsx` | RPC client is created, discarded, and not supplied to the UI. Bootstrap reports RPC opened without a successful handshake.                                                                  | The real backend is disconnected from the presentation.                                                                                 |
| Client `src/overview.ts`; our `01.24.01`                             | Version, root, commit duration, and panel route count are fabricated or mislabeled as app data.                                                                                             | All displayed runtime facts need a real source or an unavailable state.                                                                 |
| Core `src/rpc.ts`                                                    | `notifyStateUpdated` and transport-status callbacks do nothing; inspector methods return cached records; no inspector-edit RPC is present.                                                  | Passing the client into React alone is insufficient. Add the missing session/subscription and plugin dispatch contracts.                |
| Extension `content/user-app.ts`                                      | Page-side hook/Fiber traversal exists; state response supplies props/hooks and separate context metadata, not a class-state section. It snapshots state for every component during refresh. | Adapt and verify this backend; add missing sections and bound work instead of rebuilding blindly.                                       |
| Chrome extension `e2e/chrome-extension.smoke.spec.ts`                | Opens extension-owned `smoke.html`, not the DevTools panel attached to a normal application tab.                                                                                            | Existing extension smoke cannot prove the product works.                                                                                |
| Official React screenshots                                           | Both short identifiers and meaningful framework/component names exist; one selected component is marked Server and exposes Promise props.                                                   | Do not attribute every short name to production minification or promise to reconstruct names/server state that React no longer exposes. |

File paths in this table are under `packages/` unless stated otherwise. Screenshot
times refer to `Screenshot 2026-10-10 at <time>.png` in the named subfolder.

## Non-Negotiable Product Contract

1. Production code contains no synthetic component tree, demo props, fake timing,
   fake renderer, or fake root fallback. Test fixtures stay in test-only code.
2. Every displayed component belongs to the selected inspected tab/frame/root.
   The panel's own React tree must never become the inspected application.
3. Names come from real display names/types/wrappers and available source metadata.
   An internal numeric ID is never a substitute for a component name.
4. Components has separate collapsible Props, Hooks, State, and Context sections
   when those categories exist. Class state is not treated as a hook list.
5. Stores has a genuine store tree and state inspector. Registered adapter data
   crosses the extension boundary and edits reach the app. It is not a renamed
   local fixture or a duplicate of the Components pane.
6. Vue-style layout applies to every shipped page, popup, error state, and plugin
   inspector. Retaining the old card shell on less prominent pages is not done.
7. Connecting, disconnected, unsupported, empty, stale selection, permission
   denial, and injection failure are distinct truthful states.
8. Features are capability-driven. Unsupported editing/source navigation is not
   offered as a working action. No arbitrary JavaScript evaluation editor.
9. Neither our hook nor inspecting data may break the application or the official
   React extension. Both installation orders must be demonstrated.
10. Store submission and signing are separate from producing a ZIP or GitHub
    release. Do not call an unsigned Firefox ZIP an end-user installation.

## Design Specification

Use the supplied Vue screenshots as the visual authority. Consult these actual
upstream components for behavior and layout structure:

- `devtools/packages/client/src/components/common/SideNav.vue`, `SplitScreen.vue`,
  `DevToolsLogo.vue`, and `pages/overview.vue`.
- `devtools/packages/applet/src/modules/components/index.vue` and
  `components/tree/TreeViewer.vue`.
- `devtools/packages/applet/src/components/state/RootStateViewer.vue`,
  `ChildStateViewer.vue`, and field editors.
- `devtools/packages/applet/src/components/timeline/index.vue` and
  `modules/pinia/components/store/Index.vue`.
- `devtools/packages/applet/src/modules/router/` and client route pages.

Recreate the presentation in React; do not import the Vue runtime or execute the
vendored application in our bundles. Record provenance and retain required
notices for any copied assets or code.

### Shell And Brand

- Approximately 48px fixed icon rail, based on the observed reference; compact
  logo at top, functional groups/dividers, Settings at bottom, overflow handling
  for many adapters or short panels. Measure final dimensions in the reference.
- Use a recognizable React-focused product identity and consistent icons in
  panel tab, popup, rail, overview, and store listings. Do not ship Vue's logo or
  imply that this is the official Meta extension.
- Keep the reference's restrained green interaction accent and neutral near-black
  surfaces. Match selected-row treatment, border contrast, syntax colors, and
  density; do not keep our current blue-black cards and bright button tabs.
- Remove the global heading, Command/Dark buttons, pill navigation, decorative
  shadows, repeated section headers, and page-level card containers.
- Use the existing icon library if suitable, otherwise tree-shaken Lucide icons;
  no hand-built miscellaneous SVG tool icon set. Tooltips and accessible names
  are required for icon-only controls, including keyboard focus.
- Support system/light/dark themes, zoom, reduced motion, rail scrolling, and
  persisted layout without compromising the reference's dark appearance.

### Components And Stores

- Full-height flat split panes with a subtle draggable divider and independent
  scroll regions; no document scrollbar around the entire panel.
- Left toolbar: compact `Find components...` search and picker icon. Right toolbar:
  selected component name, `Filter State...`, and supported source/DOM actions.
- Dense tree rows: disclosure, indentation, real name, optional key/kind badges;
  full-width green selection, distinguishable hover/focus, virtualized rows.
- Inline typed value tree: compact name/value pairs, syntax colors, expandable
  objects/arrays, contextual editing, overflow handling. No JSON textarea as the
  main inspector and no duplicate NAME/COMPONENT ID/TAGS dashboard.
- Below the usable two-pane width, switch to a purposeful stacked or master/detail
  view. Test 360px and 420px panels and short horizontally docked windows.
- The store module follows the same visual grammar with store selection, state,
  getters/derived values, and available actions; edits are enabled per field.

### Remaining Pages

- Overview: React-focused brand, true renderer/version, root/component counts,
  session status and integrations; unknown timing stays unknown.
- Routes: dense current-route/table/detail views, backed by installed adapters.
- Timeline: layers beside an event/detail region; record/pause, clear, filters,
  bounded retention, explicit no-events state. React commits are not Vue emits.
- Settings: compact labeled controls and grouped rows; advanced import/export in
  a disclosure or dialog, not a permanently displayed JSON textarea.
- Assets/Graph/custom tabs: preserve supported workflows, flatten the old shell,
  use the same toolbar/state conventions. Do not expose Vite server features in
  extension mode when their provider is absent.
- Picker: Vue-style instruction/cancel surface, real page overlay, component name
  and dimensions; Escape, click, navigation, disconnect, and panel close clean up.

### Visual Acceptance

Match layout, spacing, hierarchy, control density, colors, and interaction states
at equivalent **panel content** dimensions, excluding browser chrome and the OS
dock. Start with roughly 20-24px tree rows and 12-13px inspector text, then measure
and adjust against the reference rather than treating these as approved values.

Create an annotated comparison sheet for Components, Routes, Timeline, Overview,
Stores, Settings, picker, and popup. The supplied images lack Stores, Settings,
light mode, and narrow panels; derive those from upstream source and capture
additional reference states before approving those designs. Golden images of
our own UI alone do not establish Vue parity. Obtain user visual sign-off on
the shell and Components before propagating the design to every page.

## Runtime Architecture

```text
Inspected app / React renderer / registered store and router adapters
  -> page-side backend: hook, roots, selection, value inspection, plugin handlers
  -> validated tab + frame + session-scoped transport
  -> core client/session store: handshake, snapshot, subscriptions, capabilities
  -> client provider + small page modules
  -> Vue-style React presentation
```

Use one normalized session contract in extension, overlay, and standalone modes.
Delivery hosts provide transport and capability adapters; pages do not read
`window.parent.document` to manufacture an alternate component model. Vite DOM
annotations may enrich source locations, not stand in for actual Fiber state.

Keep opaque stable component IDs separate from display names. Scope identity by
tab/frame/renderer/root/session and preserve it across ordinary commits and
alternate Fibers. Reset it deliberately on navigation, not by accident.

Bootstrap with a real handshake and initial snapshot, then subscribe to validated
versioned updates. Handle the snapshot/update race, stale requests, reconnects,
timeouts, disposal, and missed updates. Connection is confirmed by the backend,
not by the fact that a constructor ran. Load selected component values on demand
and coalesce tree updates rather than serializing every component on every commit.

Page plugin functions remain in the page. Send serializable descriptors and
request IDs over RPC; dispatch inspector tree/state/edit requests to their actual
handlers. Commands execute only registered page-side actions. React component
references cannot be serialized into an extension tab: use bundled approved views
or explicitly supported safe descriptors, with extension CSP boundaries.

### Backend Decision Gate

The earlier decision in
`packages/devtools-core/docs/react-devtools-backend-reuse-boundary.md` excluded
official backend dependencies and vendoring during the original phases. Reopen
that decision against real renderer evidence; do not silently reverse it and do
not treat the old spike as permanent proof of compatibility.

Run a bounded compatibility investigation before deep hook work. Compare the
existing local implementation against the official backend for names, hooks,
contexts, selection, early hook ownership, and React/Next server metadata.
Retain the local implementation if it meets the selected support matrix. If not,
propose a pinned browser-safe backend adaptation with provenance, license review,
update responsibility, bundle measurements, and an adapter boundary. Do not add
an entire Node-oriented official package or start an unbounded Fiber rewrite.

Destroyed minified names cannot generally be recovered. Preserve real short names;
prefer available explicit display names/source hints; use `Anonymous` only when
appropriate. Do not require application instrumentation to see an ordinary tree.
Do not label all hook slots `useState` or invent variable names. Server-only state
and hook names without available metadata require explicit support limits, not
mock data. Raw React state remains read-only until a tested renderer capability
supports edits; registered store adapters provide the first guaranteed editing.

## Issue-Ready Backlog

IDs below are new recovery tracking IDs, not existing GitHub issue numbers.
Create one issue per item with its scope, dependency, and acceptance criteria.
All items start unchecked. Split further only when independently testable work
is discovered; do not turn each implementation detail into another phase.

### A. Evidence And First Working Slice

- [ ] **R01 - Capture the actual installed extension failure.** Dependencies: none.
      Load Chrome and Firefox against an unannotated real React app and the user's
      target app when available. Record browser/app versions, handshake, tree, state,
      injection errors, screenshots, and tab/frame identities. Acceptance: reproducible
      failures and a short evidence report; no claims inferred from unit mocks.
- [ ] **R02 - Lock the reference design and backend decision.** Depends: R01.
      Produce measured screenshot annotations, route/state mapping, and the bounded
      backend compatibility decision above. Acceptance: an agreed shell/Components
      specification and explicit supported-runtime candidates, with unresolved risks
      named. Do not block the basic RPC wiring on speculative profiling research.

### B. Real Session, Real Components

- [ ] **R03 - Introduce the session/capability contract and client provider.**
      Depends: R01. Files: core RPC/types, client mount/runtime, both panel bootstraps.
      Inject a typed session into the UI; implement effective update/status callbacks,
      protocol version checks, initial snapshot, subscription API, and disposal.
      Acceptance: a connected extension renders backend renderer/root data, and a
      failed handshake never reports Connected. Test public mount types and StrictMode.
- [ ] **R04 - Wire the page backend's outbound updates.** Depends: R03.
      Files: extension user-app server, core state, transport. Publish coalesced,
      revisioned changes and resynchronize after missed updates. Acceptance: an app
      update reaches the panel without reload; initial-snapshot races, duplicate events,
      disconnects, and stale replies cannot replace newer state.
- [ ] **R05 - Replace all production demo data with real model adapters.**
      Depends: R03-R04. Files: client App/overview/tree/detail, all host bootstraps.
      Remove synthetic fallback and hard-coded runtime facts; move generators to
      tests; replace parent-DOM polling as the authoritative component source.
      Acceptance: unannotated extension and Vite apps show the actual tree; a non-React
      page has an honest empty state; panel navigation is never counted as app routes.
- [ ] **R06 - Verify naming and stable cross-layer component identity.**
      Depends: R02, R05. Files: Fiber walker/registry and client model adapter.
      Cover functions, classes, memo/forwardRef/lazy, providers, Suspense, portals,
      alternate Fibers, root removal, and reorder. Acceptance: meaningful available
      names match the app; selecting/updating a component does not jump to another
      component; tree IDs resolve to the correct state and DOM target.
- [ ] **R07 - Deliver real props, hooks, class state, and context.**
      Depends: R06. Add missing class-state response, preserve typed values and context
      categories, support unavailable data, and fetch selected values on demand.
      Acceptance: a named fixture's known values match the app before and after an
      update, including class `setState`, reducer state, nested custom hooks and context.
      Unsupported metadata is not presented as an invented hook name or server state.
- [ ] **R08 - Make sessions survive actual browser lifecycles.** Depends: R03-R07.
      Scope tabs/frames/roots; support navigation, HMR, early/late panel opening,
      DevTools reopen, background worker restart, root unmount, and permission loss.
      Acceptance: no cross-tab data, stale selection, duplicate injection/listeners,
      or panel self-inspection; disconnected values are not silently shown as current.
- [ ] **R09 - Connect highlight, picker, and source actions to the real backend.**
      Depends: R06, R08. Add actual page-side event handling, DOM-to-Fiber resolution,
      hover/click/cancel state transitions, scroll-to-node, and host-specific source
      navigation. Acceptance: picker selects and reveals the actual tree row; portals
      and relevant frames work; missing source actions are absent; CSP failure is clear;
      the application has no leftover listeners/overlay after cancellation or close.

### C. Hook Safety And Store Ecosystem

- [ ] **R10 - Establish official-extension coexistence.** Depends: R02, R06.
      Test both hook installation orders, official extension absent/present, and an
      incompatible existing hook. Fix early ownership/event/interface compatibility
      according to the backend decision. Acceptance: both installed panels work and
      app rendering remains intact; an unknown hook fails safely. Mere matching method
      names and a `rendererInterfaces` Map are not sufficient compatibility evidence.
- [ ] **R11 - Connect page plugin registration to the extension session.**
      Depends: R03-R04, R10. Initialize the inspected-page plugin context; propagate
      registered inspector/route/timeline/command descriptors and their removal.
      Acceptance: an app-side plugin registered before or after panel opening appears
      in the panel, without importing it into the panel's own local runtime.
- [ ] **R12 - Add remote inspector read/edit dispatch.** Depends: R11.
      Dispatch tree/state requests to page callbacks instead of static cached records;
      add permission-checked edits and explicit success/error responses. Validate
      inspector/node/path/value/session and handle async/stale responses.
      Acceptance: an edit changes the actual store and refreshes the inspector; getters
      stay read-only; forbidden paths, prototype mutation and arbitrary execution fail.
- [ ] **R13 - Ship the live Stores workspace and Nekuta vertical slice.**
      Depends: R07, R12, R18-R19. Build store list/filter/detail, state/getters/actions,
      per-field editing and plugin lifecycle states using the shared value inspector.
      Acceptance: an app-side Nekuta store appears in the installed extension; updating
      it in the app updates the pane and editing it in the pane updates the app.
      No adapter has a truthful no-stores state, not a fake store. Other store libraries
      are separate adapters, not claimed to be automatically discoverable.
- [ ] **R14 - Restore real router and custom-plugin workflows across realms.**
      Depends: R11-R12, R16. Deliver registered React Router/Next route data and safe
      custom inspector/tab/command execution. Separate panel navigation from app routes
      and honor delivery/CSP capabilities. Acceptance: route changes update live,
      app-side commands execute in the app, unsupported custom view loading is rejected,
      and adapter removal clears obsolete rail items and subscriptions.
- [ ] **R15 - Harden the bridge and value serialization.** Depends: R03, R12.
      Validate sender/tab/frame/role and message envelopes, constrain privileged
      operations, bound payloads/depth/entries, handle cycles/BigInt/Map/Set/functions/
      DOM values, and avoid invoking arbitrary getters during inspection.
      Acceptance: malformed/spoofed messages cannot trigger privileged operations or
      contaminate another session; huge or hostile values do not hang the panel/page.
      Document that page-level messaging cannot authenticate against all hostile code
      in the same page; never give it unrestricted extension capabilities.

### D. Vue-Quality Presentation

- [ ] **R16 - Replace the client shell with the branded rail.** Depends: R02.
      Extract shell/pages from the large App file incrementally as they change; add
      accessible rail/tool/search primitives, grouped navigation, bottom Settings,
      overflow, theme tokens, and panel identity. Acceptance: reference comparison
      approved by the user; no old header/pill navigation; route/plugin/command access
      remains functional. Do not add a styling framework or broad unrelated refactor.
- [ ] **R17 - Rebuild the Components tree and pane toolbars.** Depends: R05-R06, R16.
      Implement flat resizable panes, dense virtualized rows, compact badges, search
      ancestor preservation, picker and contextual tools. Acceptance: reference-like
      selected row and spacing; keyboard tree navigation, reveal-selected, persisted
      split, and independent scrolling work with thousands of real fixture components.
- [ ] **R18 - Rebuild the typed value inspector.** Depends: R07, R16.
      Shared collapsible sections and nested fields, typed syntax, lazy expansion,
      filtering, copy-value/path, truncation and supported inline editors.
      Acceptance: props/hooks/class-state/context remain distinct; users can inspect
      deep objects without horizontal layout collapse; no main JSON textarea.
- [ ] **R19 - Apply the store-specific inspector presentation.** Depends: R12, R18.
      Match Vue's store inspector grammar using upstream Pinia views, with real adapter
      identity, compact store tree and state/getter/action sections.
      Acceptance: reference comparison plus editable/readonly/error/loading states;
      shared inspector primitives, not a second conflicting design system.
- [ ] **R20 - Replace Overview and Settings with reference-quality pages.**
      Depends: R05, R16. Branded unframed overview, accurate summaries, functional
      theme/density/motion controls, bounded preference persistence and advanced tools.
      Acceptance: no fabricated version/root/timing/count and no nested-card dashboard;
      settings affect the real layout/session; browser theme changes work.
- [ ] **R21 - Restyle Routes, Assets, Graph and custom views consistently.**
      Depends: R14, R16, R18. Preserve capability-specific actions, compact tables,
      inspectors, graph controls, empty/error states and adapters.
      Acceptance: all reachable pages use the new design; extension mode never offers
      a server-only Vite operation as an active control without a working provider.
- [ ] **R22 - Match picker, popup and extension branding.** Depends: R09, R16.
      Add legitimate React-focused assets, native panel icon/title, status popup,
      page highlight label and Vue-style picker instruction/cancel dialog.
      Acceptance: screenshots match the selected visual grammar, popup accurately
      reflects the active tab, Escape restores focus, and repeated activation cleans up.
- [ ] **R23 - Finish responsive, theme and accessibility parity.**
      Depends: R13, R17-R22, R25. Cover 360/420px widths, desktop, short docked panels,
      light/dark/system, 200% zoom, focus/selection contrast, screen-reader labels,
      keyboard resize, reduced motion and tooltip portals.
      Acceptance: no overlapping content, unusable tools or accidental outer overflow;
      manual keyboard pass and visual sign-off, not just bounding-box assertions.

### E. Honest Performance And Usability

- [ ] **R24 - Record real React commit and plugin timeline data.**
      Depends: R04, R10-R11. Define recording/paused semantics, bounded retention,
      root/frame attribution and timestamp versus measured duration. Avoid double
      counting commit/post-commit callbacks. Acceptance: actual app updates produce
      correct events; pause/clear work; duration is absent unless genuinely measurable;
      Mouse/Keyboard/component-event layers are not fabricated to copy Vue's labels.
- [ ] **R25 - Build the Vue-style Timeline workspace.** Depends: R16, R24.
      Layer list, recording/clear icons, event list/time view, selection/details,
      filters and honest empty state. Acceptance: recorded app/plugin events can be
      found and inspected; screenshot comparison to `01.16.50`; no placeholder page.
- [ ] **R26 - Bound backend and panel overhead.** Depends: R07-R08, R24.
      Measure page/frame cost separately from panel render cost with 1,000 and 10,000
      component stress fixtures; batch patches, limit recording and fetch state lazily.
      Establish reproducible p50/p95 budgets on a documented test machine, then enforce
      regression limits. Acceptance: opening, searching, selecting and recording stay
      responsive; rapid commits do not cause unbounded memory or full-tree state dumps.
- [ ] **R27 - Rebaseline dependencies and payloads deliberately.**
      Depends: R13-R26. Preserve browser/API boundaries; inspect new icon/backend chunks
      and tree-shaking. Acceptance: reviewed before/after raw/gzip reports per delivery
      target; no Node/Vite server modules or UI dependencies leak into the public API;
      any necessary budget increase includes justification, not an automatic refresh.

### F. Evidence-Based Test Gates

- [ ] **R28 - Add an unannotated real-app fixture matrix.** Depends: R02.
      Fixtures: supported React development and optimized production builds; Next App
      and Pages routers; named stateful/class/wrapped/context/portal/multi-root shapes;
      store adapter; no React; empty root; incompatible hook; selected restrictive CSP.
      Acceptance: known component names/values and interactions are documented; the
      no-plugin tree/state case needs no DOM annotations or DevTools app imports.
- [ ] **R29 - Test the actual Chrome extension panel end to end.**
      Depends: R08-R13, R17-R19, R28. Replace smoke-only acceptance with page -> hook ->
      MAIN/isolated world -> background -> real panel transport. Prove panel-host
      inspected tab identity; never manufacture an `inspectedWindow` context and call
      that native DevTools coverage. Acceptance: real names, changing props/hooks/
      state/context, two-way store edits, picker, reload/reopen and no fixture leakage.
      Missing browser/extension loading must fail required CI, not silently skip.
- [ ] **R30 - Establish genuine Firefox extension verification.**
      Depends: R08-R13, R28. Use Firefox/WebExtension tooling and a browser-chrome
      automation feasibility spike for its native panel; share assertions, not a fake
      Playwright extension launch. Acceptance: real Firefox extension/session smoke
      runs; native-panel cases not automatable have an explicit manual release gate
      with fresh screenshots and logs. A tested UAT helper is not Firefox UAT.
- [ ] **R31 - Add visual, lifecycle and coexistence regression suites.**
      Depends: R10, R23, R25, R29-R30. Approved screenshot baselines for shell,
      Components, Stores, Timeline, Overview, Settings, picker and popup; both hook
      installation orders, reload, multi-tab/root/frame, reconnect, stale replies.
      Acceptance: controlled browser/fonts/data fixtures; reference comparison reviewed;
      real panel identity preserved; manual coexistence evidence where automation is
      incomplete. Never blindly approve changed golden images to make CI pass.
- [ ] **R32 - Make release gates fail on user-visible breakage.**
      Depends: R29-R31. Add required extension integration jobs/artifacts alongside
      existing formatting/lint/type/unit/bundle/packaging gates. Retain traces and
      screenshots, enforce 80% global statements/branches/functions/lines where
      applicable, and test forbidden fixture leakage and fabricated runtime values.
      Acceptance: deliberately break the RPC link and a key visual rule; the relevant
      CI gates fail. Update obsolete tests, not merely their expected placeholder text.

### G. Public Browser Distribution

- [ ] **R33 - Separate development/test and store manifests.**
      Depends: R15, R22. Preserve deterministic development identity without blindly
      removing or shipping a test key; audit Chrome manifest key strategy, icons,
      permissions, content-script worlds/frames, CSP, web-accessible resources and
      source injection. Remove smoke/test resources from store artifacts.
      Acceptance: minimum-permission store builds load on supported browsers, including
      CSP-restricted fixtures; test assets never appear in the distribution archive.
- [ ] **R34 - Prepare Firefox identity, consent and signing.**
      Depends: R30, R33. Choose durable Gecko ID, supported Firefox range and manifest
      version from tested capabilities/current AMO requirements. Add accurate data
      collection declaration. Build and validate source submission; request signing.
      Acceptance: signed XPI installs and survives restart in normal Firefox, not only
      temporary loading in Developer Edition. Do not make an unrelated MV3 migration
      a release prerequisite without an actual compatibility/policy reason.
- [ ] **R35 - Make release packaging reproducible and licensed.**
      Depends: R27, R32-R34. Resolve MIT LICENSE versus UNLICENSED manifests; preserve
      third-party notices. Pin the tested build inputs and produce a submission source
      archive with lockfile/build instructions; align each manifest to its package.
      Acceptance: clean reconstruction of release artifacts, checksums, changelog,
      source archive, and downloadable extension assets. Root and unrelated libraries
      need not share one version; synchronize the two extension versions if that is
      the chosen product-release policy, rather than forcing the entire monorepo.
- [ ] **R36 - Create privacy, support and store-listing materials.**
      Depends: R15, R22, R34. Document actual inspection/storage/network behavior,
      permission reasons, support matrix, limitations, installation, troubleshooting,
      issue reporting and release changes. Produce real final-UI listing screenshots.
      Acceptance: disclosures match measured behavior and store forms; no unsupported
      claim that inspecting sensitive page state means the extension accesses no data.
      Product/account ownership, contact, name, Gecko ID and listing approval need the
      repository owner's decisions, not invented credentials or identities.
- [ ] **R37 - Add candidate packaging and publication workflow.**
      Depends: R32, R35-R36. Build/test/package once from the candidate commit; retain
      archives, checksums, source submission, bundle report and QA evidence. Use
      protected store secrets and manual publication approval initially.
      Acceptance: installed artifacts are exactly those tested; a GitHub release is
      distinguished from signed/approved store distribution; no premature stable tag.
- [ ] **R38 - Run release-candidate UAT and publish.** Depends: R01-R37.
      Fresh Chrome and Firefox profiles, target app plus fixture matrix, official
      extension installed both orders, package install/update/restart/uninstall,
      real state/store editing, themes/layout, security failures and visual review.
      Acceptance: owner signs the evidence sheet; store review/signing succeeds; real
      users can install the approved artifacts; support/rollback procedure is verified.

## Delivery Order And Stop Conditions

| Milestone                | Work                                           | Gate                                                                                                       |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| M0: verified target      | R01-R02; begin R28                             | Failures reproduced; measured design and backend decision documented.                                      |
| M1: real extension slice | R03-R07, R10; R16 in parallel; begin R29-R30   | Actual unannotated app tree and values in an installed panel; approved shell/Components direction.         |
| M2: complete inspector   | R08-R09, R11-R15, R17-R19, R22                 | Stable sessions, actual picker, page plugin discovery and two-way Stores editing.                          |
| M3: complete product     | R14, R20-R27; R28-R31 alongside implementation | Every shipped view uses the design, timeline is real, performance/accessibility evidence exists.           |
| M4: release candidate    | R32-R37                                        | Fail-closed CI, reviewed packaging/privacy, signed Firefox candidate and installable Chrome candidate.     |
| M5: public release       | R38                                            | Fresh-profile UAT and owner visual sign-off; store approval/signing, published artifacts and support path. |

Tests accompany each vertical slice; they are not a cleanup phase after the UI.
Do not run the whole data backlog before showing the user a first real Components
screen. Conversely, do not spend weeks polishing pages around fabricated values.

No calendar estimate until R01-R02 resolves backend compatibility and native-panel
automation feasibility. Then estimate remaining independently testable issues and
update this finite backlog. Add new scope only for demonstrated release blockers.

Future adapters, arbitrary generic React state editing, full profiler/flamegraphs,
React Native, inaccessible server internals, and remote debugging are not implied
v1 promises. The release must explicitly identify supported client renderers,
framework modes, store adapters and capability limitations. Stores, props/state,
Vue-quality Components, and normal browser installation are not optional.

## Release Evidence And Go/No-Go

The release record must include candidate commit/version, browser/OS/app versions,
tested artifact hashes, fixture/real-app URLs, actual panel screenshots, automated
reports, manual exceptions, permission/network audit and owner's visual approval.
Redact application secrets from screenshots, exported values and diagnostic logs.

- [ ] Real tree and values in Chrome and Firefox; no fixture leakage/fake metrics.
- [ ] Names preserved where available; unsupported/minified/server metadata honest.
- [ ] Live Props, Hooks, State, Context and registered Stores verified against app.
- [ ] Store read/write round trip and readonly enforcement demonstrated.
- [ ] Picker, highlight, source capability and cleanup demonstrated.
- [ ] Reload/reopen/navigation/worker restart/multi-tab/root/frame isolation verified.
- [ ] Official extension coexistence verified in both installation orders.
- [ ] All shipped screens approved against the Vue visual/interaction target.
- [ ] Dark/light, narrow/short panels, zoom, keyboard and reduced motion verified.
- [ ] Recording, memory/runtime overhead and bundle/dependency checks accepted.
- [ ] Security/CSP/privacy/license/permission requirements reviewed.
- [ ] Clean-profile packaged installs and updates pass; Firefox candidate is signed.
- [ ] Store materials, support ownership and rollback/update procedures are ready.

A failure in any applicable line blocks the public release. A documented support
limitation cannot waive a broken basic inspector or unacceptable presentation.
Unpacked developer installation, signed beta availability, store submission and
public store approval are different statuses and must be reported separately.

### Per-Issue Engineering Workflow

Use the user's existing issue-derived branch -> implementation -> affected-package
version bump -> checks -> PR -> merge without approval -> appropriate release ->
main -> local/remote branch cleanup workflow. Development releases remain clearly
experimental until the public go/no-go gate; publication needs explicit approval.
Preserve unrelated user changes, including the supplied screenshot directory.

Run the existing root checks plus each issue's new integration/visual tests:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:bundle-checks
npm run test:release-packaging
npm run test:firefox-uat-helper
npm run build
npm run check:bundles
npm run test:product-smoke
```

Add explicit Chrome-panel, Firefox-extension and visual-test commands as R29-R32
lands. These commands today are necessary but insufficient: the Vite product
smoke is not extension validation, and the Firefox helper test is not installation
or native-panel validation. Report what was actually exercised, not only green CI.

## Improvements Over The Supplied Plan

- Verify the no-op subscriptions, plugin dispatch and page backend gaps rather
  than assuming the only missing step is passing an RPC object to React.
- Remove the annotated-DOM shortcut as the component data authority in every mode,
  not just synthetic fallback in the extension.
- Make class state, contexts, live cross-realm store edits, stable IDs, lifecycle
  isolation and safe serialization explicit release blockers with acceptance tests.
- Approve a real Components vertical slice and its visual design early; do not
  postpone presentation until every backend feature is complete.
- Treat hook coexistence as an evidence-based compatibility decision, not a
  proven failure or a trivial minimal-hook replacement.
- Use actual Firefox extension tooling, retain honest native-panel automation
  limits, and require signed normal-browser installation.
- Avoid unnecessary monorepo-wide version unification and speculative Firefox
  MV3 migration. Require reproducible source submissions instead.
- Make security, local overhead, data/privacy truthfulness and user visual sign-off
  first-class gates. Prevent the same mock-driven completion mistake from recurring.

## External Requirements Checked

These sources were checked for this plan. Recheck them immediately before store
submission; browser/store policies and tooling support can change.

- [Playwright extension testing](https://playwright.dev/docs/chrome-extensions):
  extension support uses Chromium persistent contexts; this is not a Firefox
  extension test strategy. Native DevTools-host coverage still needs demonstration.
- [Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/):
  temporary loading is a development workflow, not equivalent to signed installs.
- [Firefox signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/):
  distinguish signed self-distribution from AMO listing and temporary loading.
- [Firefox source submissions](https://extensionworkshop.com/documentation/publish/source-code-submission/):
  include source and instructions sufficient to reproduce processed extension code.
- [Firefox data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/):
  new submissions must declare data collection/transmission; `none` is appropriate
  only when the actual behavior qualifies. This is not a blanket no-access claim.
- [Chrome MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements):
  review bundled versus remotely executed code, including plugin/custom-tab paths.
- [Chrome store policies](https://developer.chrome.com/docs/webstore/program-policies/policies):
  review permissions, user data, disclosures and actual extension functionality.
