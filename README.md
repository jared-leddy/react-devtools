# react-devtools

Our version of React DevTools is modeled after Vue's official DevTools, which is super clearn and easy to use.

## Pull Request Checks

The `CI` GitHub Actions workflow runs on every pull request and every push to
`main`. Its stable `CI checks` job runs formatting, lint, typechecks, unit tests
with the workspace coverage gates (80% global statements, branches, functions,
and lines), release-packaging/helper tests, and the full build. It uses the Node
version in `.nvmrc` and the npm version in `package.json`.

The repository intentionally does not track an npm lockfile, so CI uses
`npm install`, not `npm ci`. npm's download cache is keyed by workspace package
manifests; installed `node_modules` are not restored. Turbo task results are
cached separately and keyed by runner, dependency/configuration hashes, and
commit. Pull requests can reuse caches within GitHub's cache-access rules;
the workflow does not need repository secrets or a write-enabled token.

`main` requires `CI checks` before merge. Do not add path filters or rename the
job without updating branch protection: a required job must report for every
pull request. Superseded PR runs are canceled; main-branch runs are retained.
The job has a 30-minute timeout, and its step timings provide the baseline for
tracking installation, typecheck/build dependencies, tests, and warm-cache runs.

Run the same checks locally with:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:release-packaging
npm run test:firefox-uat-helper
npm run build
```

## Product Smoke Tests

Install Chromium once with `npx playwright install chromium`, then run
`npm run test:product-smoke`. The command builds the Vite playground's delivery
dependencies and starts an isolated server on `127.0.0.1:9032`; that port must be
free. The runner shuts down the server after the tests.

The suite exercises the real overlay iframe, connection overview, live annotated
page tree, selection and page updates, click-to-inspect, asset image previews,
and Vite module relationships. Standalone panel tests at 360px and 420px verify
critical pane bounds, non-overlap, navigation, and horizontal overflow.

Screenshots are attached to the HTML report for visual review; geometry assertions
are the automated layout gate, not pixel-baseline comparisons. Inspect results
with `npx playwright show-report apps/vite-playground/playwright-report`.
Failures retain a screenshot and trace in `apps/vite-playground/test-results`.
CI runs this suite inside the required `CI checks` job and uploads its report and
diagnostics for seven days. The existing Chrome-extension harness is separate.

## Phase 1 verification

Run the Phase 1 end-to-end smoke script with:

```sh
npm run prototype:phase1 --workspace=@devtools/kit
```

The script builds the real `@devtools/kit` and `@devtools/api` packages, registers a fake inspector via `setupDevToolsPlugin`, and verifies inspector tree/state data over the iframe transport preset.
