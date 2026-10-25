# R07: Real selected component values

Issue: [#252](https://github.com/jared-leddy/react-devtools/issues/252).

## Contract and behavior

`getComponentState({rootId, componentId})` returns separate Props, Hooks, Class
State and Context sections where applicable. Class state comes from the selected
committed Fiber's `memoizedState`, not a mutable instance or a fabricated hook
list. Context values come from observed dependencies or a provider's committed
value. A consumer without recorded dependencies reports unavailable rather than
reading a potentially unrelated global default.

The response explicitly declares props/hooks/state/context editing unsupported.
The session also advertises `edit: false`. Values remain read-only. Section
`status` and `notice`, and value `_custom.unavailable` / `_custom.truncated`, are
additive contract fields understood by the shared inspector. Empty, unavailable
and not-applicable data are distinct; unavailable notices remain visible even
when a section has no fields.

Primitive React development hook metadata identifies supported simple slot
layouts, including primitive slots inside nested custom hooks. No custom-hook or
variable names are invented. Production slots retain observed values and use
`state-or-reducer` when the renderer does not expose enough information to
distinguish them. Unsupported primitive layouts use bounded best-effort slots;
custom-hook grouping and server metadata are explicitly unavailable.

Values preserve booleans, strings, finite numbers and null; undefined, non-finite
numbers, bigint, functions, symbols, dates, regular expressions, Maps, Sets,
objects and instances use transport-safe typed representations. Normal enumerable
property accessors are not invoked. Unreadable objects report unavailable. Cycles
stop expansion; repeated references are not falsely called cycles. Fields use a
shared per-inspection budget of 1,000 visited values and 2,000 characters per
string, depth four, 50 collection/object entries, 50 top-level props and 100 hook
slots/context dependencies. Truncated values carry visible markers. Proxy traps
and custom collection implementations cannot be made side-effect-free by an
inspector; failures are contained rather than represented as fabricated values.

Only selected values are formatted. Component-tree pushes strip raw context
values and captured errors, retaining metadata. Commits refetch the selected
inspection; existing session/revision/selection guards reject obsolete responses.
The client regression for a delayed response after switching components remains
part of the unit suite. Source-map reconstruction, custom-hook grouping, arbitrary
React editing, store adapters and the Vue-style visual redesign remain separate
issues.

## Reproduction

After `npm run build`, run `npm run test:values-smoke`. Its owned fixture server
uses port 9056 and removes temporary bundles on shutdown. Four real React 19.1.1
scenarios cover development/production through overlay/standalone. Each checks
actual changed props, nested hook state, reducer objects, observed context, class
`setState`, typed unavailable/truncated values and unmount. No component/JSX
annotations or fake RPC replies supply the inspected data.

For installed native browsers, start `node docs/recovery/r07/serve-fixture.mjs`:

```sh
node scripts/native-session-chrome.mjs http://127.0.0.1:9056/development /private/tmp/r07-chrome --values
node scripts/native-session-firefox.mjs http://127.0.0.1:9056/development /private/tmp/r07-firefox --values
```

Repeat with `/production`. Chrome operates the real registered panel bound to the
fixture's inspected tab. Firefox asserts its disposable browser profile, records
the actual panel browsing context, selects components using real keyboard actions,
and passively observes inspection responses. Both verify functional and class
values before/after actual application updates. Screenshots are unedited; no
visual-parity claim is made.

All required format/lint/typecheck/unit/packaging/helper/build/bundle/product gates
retain their thresholds, including global 80% coverage and existing bundle budgets.
The existing model and identity matrices remain in CI alongside the new value
matrix. Native observations, source/build versions, archive hashes, coverage and
checksums are recorded under `evidence/` for delivery.

Versions: workspace 0.1.13, core 0.0.26, client 0.0.34, overlay 0.0.13,
Chrome 0.0.21 and Firefox 0.0.12. These are development builds, not approved
browser-store distributions.

## Delivery evidence

Application source: `f89d7b883b2f71cd221d68a2d621c0e9cd4fa374`.
Verification head: `9fddbab59c6e522f03ef45994298fd3efdfa5c3a`; the latter changes
only the borrowed-session test's fixed delay to an observed-update wait.
[Build provenance, coverage, bundle sizes and archive hashes](evidence/build.json)
and [web-host observations](evidence/hosts.json) identify the tested application.
Installed Chrome 155.0.8059.85 and Firefox 159.0 passed development and production
checks. Matching JSON reports accompany these unedited native captures:

- [Chrome development class state](evidence/chrome-development-class.png)
- [Chrome production class state](evidence/chrome-production-class.png)
- [Firefox development class state](evidence/firefox-development-class.png)
- [Firefox production class state](evidence/firefox-production-class.png)
- [Chrome production hook values](evidence/chrome-production-function.png)

The reports record nested hook state 5→6, reducer count 2→3, props revision 0→1,
context light→dark and class state 10→11 on the same component identities. The
Firefox records retain typed inspection replies and explicit edit capabilities.
Chrome's raw report retains expected permission failures for its spare
`about:blank` tab; the scenario explicitly binds to the fixture's real native panel.

All required local gates pass, including 161 core tests, the async-selection race
regression, eight product smoke tests and all three host matrices. The overlay is
275,639 raw / 86,122 gzip bytes, within unchanged limits. Evidence integrity is
recorded in [SHA256SUMS](evidence/SHA256SUMS). Browser-store approval, visual parity,
hook-name reconstruction and arbitrary React editing are not claimed.
