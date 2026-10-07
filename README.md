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

## Phase 1 verification

Run the Phase 1 end-to-end smoke script with:

```sh
npm run prototype:phase1 --workspace=@devtools/kit
```

The script builds the real `@devtools/kit` and `@devtools/api` packages, registers a fake inspector via `setupDevToolsPlugin`, and verifies inspector tree/state data over the iframe transport preset.
