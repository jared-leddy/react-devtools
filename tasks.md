# Tasks

## Architecture Decisions

### P1-A03: React DevTools Backend Reuse Boundary

Status: decided.

Use a direct React runtime implementation for the backend and Fiber walker.
Official React DevTools source may be studied as a behavior reference, but
`react-devtools-core`, `react-devtools-inline`, and `react-devtools-shared` are
not runtime dependencies and are not vendored for Phase 1 or Phase 2.

Decision record:
`packages/devtools-core/docs/react-devtools-backend-reuse-boundary.md`
