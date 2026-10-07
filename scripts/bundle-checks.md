# Bundle Budgets And Dependency Boundaries

Run `npm run check:bundles` to build the client library, standalone panel,
overlay, and Chrome/Firefox extensions and check `bundle-budgets.json`.
Each budget caps the sum of JavaScript and CSS bytes, both raw and gzip level 9
(each file compressed separately). Shared chunks count once per delivery target.
Source maps, declarations, HTML, and images are excluded. Empty/missing JavaScript
output is an error. These are delivery payload budgets, not archive sizes.

CI runs guard tests with 80% line/branch/function coverage thresholds,
enforces budgets, and uploads `artifacts/bundle-report.json` with actual sizes
and limits. Adjust limits explicitly in a reviewed PR when a deliberate feature
or dependency increase warrants it; do not automatically refresh them.

The Vite build plugin inspects resolved module graphs, including external
imports and Vite browser-external stubs. Node builtins, Vite's server runtime,
server delivery plugins, and known Node-only serving/editor packages are rejected.
Vite's exact virtual browser preload helpers and `vite-hot-client` are allowed
browser code, not general exceptions for Vite imports. Turbo's global inputs
include the guard so cached builds cannot bypass policy changes.

The public API check recursively follows installed runtime, optional, and peer
dependency manifests (never development dependencies). It rejects server-only
and React application packages even when introduced transitively. The sole host
peer exception is `vite-hot-client` declaring `vite`, required by the existing
browser transport; Vite in its runtime/optional dependencies still fails.
Unresolvable runtime dependencies fail closed.

A write-free browser build of the API also checks its resolved imports with
the stricter API policy, catching undeclared application imports that happen
to resolve from hoisted workspace dependencies.

`npm run test:bundle-checks` exercises success and failure paths with temporary
fixtures, including oversized payloads, bad/empty budgets, resolved server
modules, browser-external stubs, API dependency leaks, and dependency cycles.
