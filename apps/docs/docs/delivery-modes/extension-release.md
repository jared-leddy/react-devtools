---
title: Extension Release Packaging
---

# Extension Release Packaging

The Chrome and Firefox extension release flow is driven by
`scripts/extension-release.mjs`. It updates package and manifest versions,
builds both extension packages, writes ZIP artifacts, and writes SHA-256
checksum files.

## Dry Run

Preview the complete release without changing files or creating artifacts:

```bash
npm run extensions:prepare -- --version 0.1.0 --dry-run
```

Preview one browser target:

```bash
npm run extensions:package -- --target firefox --dry-run
```

## Version Bump

Update Chrome and Firefox package versions, manifests, and smoke harness version
labels:

```bash
npm run extensions:version -- --version 0.1.0
```

The command keeps these files aligned:

- `packages/devtools-chrome-extension/package.json`
- `packages/devtools-chrome-extension/public/manifest.json`
- `packages/devtools-chrome-extension/src/smoke.tsx`
- `packages/devtools-firefox-extension/package.json`
- `packages/devtools-firefox-extension/public/manifest.json`
- `packages/devtools-firefox-extension/src/smoke.tsx`

## Package Artifacts

Build and package both browser extensions from a clean checkout:

```bash
npm run extensions:package
```

The default output directory is `dist/extensions`. Artifact names use this
convention:

- `react-devtools-chrome-extension-v<version>.zip`
- `react-devtools-chrome-extension-v<version>.zip.sha256`
- `react-devtools-firefox-extension-v<version>.zip`
- `react-devtools-firefox-extension-v<version>.zip.sha256`

When the extension packages are already built, skip the build step:

```bash
npm run extensions:package -- --skip-build
```

## Store Submission

1. Start from a clean `main` checkout.
2. Run the full verification suite: `npm run format:check`, `npm run lint`,
   `npm run typecheck`, `npm run test:unit`, `npm run build`, and
   `npm run test:e2e`.
3. Run `npm run extensions:prepare -- --version <version>`.
4. Confirm the ZIP files and `.sha256` files in `dist/extensions`.
5. Load the Chrome ZIP through the Chrome Web Store developer dashboard and use
   the Chrome extension smoke checklist before submission.
6. Load the Firefox ZIP through Mozilla Add-ons and follow the Firefox smoke
   checklist in `packages/devtools-firefox-extension/FIREFOX_SMOKE_CHECKLIST.md`.
7. Attach the checksum values to the release notes so reviewers can verify the
   exact uploaded artifacts.
