# React DevTools Backend Reuse Boundary

Issue: [P1-A03](https://github.com/jared-leddy/react-devtools/issues/3)

## Decision

Use a direct React runtime implementation for the app-facing backend, with
selective study of the official React DevTools source. Do not add
`react-devtools-core`, `react-devtools-inline`, or `react-devtools-shared` as
runtime dependencies, and do not vendor official backend modules during Phase 1
or Phase 2.

The boundary is:

- `@devtools/kit` owns global hook coexistence, transport primitives, and plugin
  primitives.
- `@devtools/core` owns browser/node-safe serialized runtime state and RPC
  contracts.
- Future Fiber walker packages own best-effort Fiber traversal and convert raw
  React internals into `@devtools/core` records before crossing RPC.
- Official React DevTools source may be used as a reference for edge cases,
  naming behavior, hook composition, and compatibility tests, but copied code
  requires a separate explicit vendoring issue and attribution review.

## Package Review

`react-devtools-core` is a Node-oriented official DevTools package. The current
npm package inspected for this spike is `8.0.0`, MIT licensed, and about
13.4 MB unpacked. It depends on `ws` and `shell-quote`, which are not suitable
for a browser-first embedded panel runtime.

`react-devtools-inline` is also MIT licensed at `8.0.0`, but is about 17.2 MB
unpacked and packages an inline DevTools experience rather than a clean backend
library boundary for this Vue-DevTools-modeled UI.

`react-devtools-shared` is not a usable npm dependency for this project. The npm
package resolves to `0.0.1-security`, which is a placeholder rather than the
source package used inside the React monorepo.

The official React repository is MIT licensed, so studying behavior is allowed.
Vendoring remains intentionally out of scope because it would create update,
size, attribution, and compatibility obligations that are larger than the
current backend surface.

## Fiber Walking Boundary

Build our own serialized Fiber model instead of depending on official renderer
interfaces directly. The Phase 2 implementation should still compare behavior
against the official backend for these areas:

- display names for memo, forwardRef, lazy, context, providers, and consumers
- hook names and hook source locations where available
- owner stacks and component source metadata
- Suspense, Offscreen, error boundary, and portal representation
- DOM node to Fiber lookup behavior
- version guards for unsupported or minified React internals

Direct Fiber walking gives this project control over bundle shape, RPC payloads,
and the UI data model. It also keeps the official extension coexistence story
clean: raw official backend objects remain inside the page, while the client
only receives `@devtools/core` records.

## What May Be Reused

Allowed reuse without a new vendoring issue:

- behavior references from official React source files
- public hook method names already used by React renderers
- compatibility test scenarios derived from observed behavior
- MIT-licensed snippets shorter than the project attribution threshold when
  rewritten into project-local style

Not allowed without a new issue:

- importing official backend packages in runtime code
- bundling official backend modules into browser/client packages
- copying large source files from `react-devtools-shared`
- exposing official backend renderer interfaces over `@devtools/core` RPC

## Phase 2 Impact

No Phase 2 issue needs to change direction from this spike. The existing Phase 2
Fiber walker work remains required, and the implementation path is now explicit:
direct implementation with official behavior used as a reference oracle.

The Phase 2 issues most affected by this boundary are:

- P2-A01 / #5: define Fiber types and version guards locally.
- P2-01 / #73: implement `FiberWalker` traversal locally.
- P2-02 / #74: assign stable local ids across commits.
- P2-03 / #75 and P2-04 / #76: normalize component kinds locally.
- P2-07 / #79 and P2-08 / #80: extract props/hooks into serialized records.
- P2-11 / #83: include official-backend comparison fixtures where possible.

## Task List Note

The current checkout did not contain an existing `tasks.md` file when this issue
was implemented. A root task-list note was added with the same decision summary
so the issue acceptance criteria remains traceable.
