# R06: Component names and identity

Issue: [#251](https://github.com/jared-leddy/react-devtools/issues/251).

## Identity contract

Component IDs are opaque `c:<random scope>:<counter>` tokens. Each root record
owns its allocator; different roots, renderer registries and fresh producer
sessions cannot share identities. Names, React keys, sibling positions and source
paths are metadata, never lookup keys. Consumers must use IDs returned by the
backend, together with the matching root ID. Persisted IDs from a previous session
are deliberately invalid.

A reciprocal, same-type, same-key alternate pair shares one identity. Registry
refreshes reconcile mounted Fibers and retire missing IDs. Unmount/remount, root
removal and session teardown cannot assign an old ID to a replacement component.
The walker and state/DOM lookup share `record.identities`; callers constructing
their own walker must pass that allocator when they need registry-compatible IDs.
The legacy `createFiberComponentId` export no longer derives IDs from paths and
must not be used to predict a server-generated ID.

Root-scoped inspection and highlighting flush pending refreshes before lookup.
Removed selections/highlights clear without selecting a different component.
On-demand inspection includes observed DOM bounds when a host descendant exists;
an empty component cannot resolve a neighboring sibling's DOM. Portal descendants
remain valid targets. Bounds are page viewport CSS pixels at inspection time,
not a promise of a permanent element handle.

## Names and metadata

The walker reads available function/class names, explicit display names and nested
memo/forwardRef/resolved-lazy metadata without running lazy initializers. Optimized
memo Fibers preserve their public wrapper name from `elementType`. Providers,
consumers, Suspense and portals have truthful structural labels. Minified names
stay short; absent names use Anonymous or wrapper fallbacks. No destroyed name is
invented. Valid legacy `_debugSource` metadata is preserved; an unavailable column
is zero. Source maps and editor actions remain later work.

The client retains wrapper tags, source metadata and actual React keys. Newly
mounted root identities expand in the tree; invalid requested selections remain
unselected. This change establishes data correctness. The planned Vue-style shell,
full value decoder and picker UI remain their separately tracked issues.

## Reproduction and evidence

After `npm run build`, run `npm run test:identity-smoke`. Its server owns port9055
and cleans its temporary fixture bundles. The real React19.1.1 fixture has no JSX
or component annotations. Development and minified production run independently
through overlay and standalone hosts. Assertions cover available names, keyed
reorder, state updates, label changes, lazy resolution, same-key remount, multiple
roots and root replacement, with no silent selection fallback.

For installed native browsers, start `node docs/recovery/r06/serve-fixture.mjs`,
then use the existing diagnostic helpers with `/development` or `/production`:

```sh
node scripts/native-session-chrome.mjs http://127.0.0.1:9055/development /private/tmp/r06-chrome --identity
node scripts/native-session-firefox.mjs http://127.0.0.1:9055/development /private/tmp/r06-firefox --identity
```

Chrome uses its actual registered extension panel and inspected-tab identity.
Firefox verifies its disposable profile and native panel browsing context, uses
keyboard navigation in that panel, and passively records the real inspection RPC
responses. Firefox checks that selected state and DOM bounds match the actual row
after increment/reorder/rename; the complete removal/remount matrix is covered by
Chrome, overlay and standalone. No diagnostic replaces `inspectedWindow`, injects
a substitute component tree or synthesizes RPC replies.

Focused unit regressions cover alternate swaps, malformed cycles/pairs, allocator
disposal, independent roots/registries, nested wrappers and state/DOM roundtrips.
The global 80% statements/branches/functions/lines gates and bundle budgets remain
unchanged. CI runs the identity matrix in addition to existing product/model tests.

Versions: workspace0.1.12, core0.0.25, client0.0.33, overlay0.0.12,
Chrome0.0.20, Firefox0.0.11. These are development builds, not approved store releases.
Final build, browser observations and checksums are recorded in `evidence/`.
