---
title: Troubleshooting
---

# Troubleshooting

Use this page when the client, browser extension, or Vite plugin reaches a
deliberate diagnostic state. Each section maps to UI copy that can appear in the
popup, standalone client, embedded overlay, or Vite delivery mode.

## React not detected {#react-not-detected}

The UI can show **React not detected**, **No React detected**, or **No renderers
detected** when the transport is alive but no compatible React renderer has
called the global hook yet.

Check these first:

- Confirm the inspected page actually mounts React after the DevTools runtime is
  injected. Static HTML, server-only routes, and pages that have not hydrated yet
  will not report roots.
- Refresh the inspected page after opening the extension panel or embedded
  client so the hook can observe renderer injection from the beginning of the
  page lifecycle.
- For extension delivery, inspect an ordinary `http://` or `https://` page. The
  extension intentionally does not inject into `chrome://`, Web Store,
  extension-owned, PDF viewer, or other privileged browser pages.
- For iframe-heavy apps, confirm the React app is inside a frame that allows the
  extension or Vite client to inject scripts.
- For Vite delivery, confirm the React DevTools plugin is installed in the Vite
  config that serves the current page.

Expected recovery: once a renderer reports, the Overview page should list the
renderer and root rows, and the blocked feature tab should become available.

## Official React DevTools hook conflict {#official-react-devtools-hook-conflict}

React exposes one `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` slot. This project is
designed to coexist with the official React DevTools extension by observing or
wrapping the existing hook instead of replacing it.

If one tool works and the other stops receiving updates:

- Reload the inspected page with both tools already installed so each one sees a
  stable hook during renderer injection.
- Disable any experimental local script that assigns
  `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` directly.
- Check the console for hook installation errors from either extension.
- Prefer one delivery mode per page while debugging. For example, do not run the
  browser extension and a manually embedded standalone client unless you are
  explicitly verifying hook coexistence.

If the official extension panel still sees the tree but this DevTools client
does not, capture the page URL, delivery mode, React version, and extension
channel before filing an issue.

## Unsupported React version {#unsupported-react-version}

The UI can show **Unsupported React version** when a renderer was detected but
the DevTools build cannot safely inspect its internals.

Common causes:

- The app uses a React version older than the minimum version shown by the
  diagnostic.
- The renderer is a custom or pre-release React renderer that does not expose
  the fields used by the current inspector.
- The page bundles multiple React versions and the unsupported renderer is the
  one connected to the mounted root.

Recovery options:

- Upgrade the inspected app to a supported React version.
- If the app intentionally uses a custom renderer, verify that renderer injection
  reports enough metadata for component tree inspection.
- Refresh after upgrading; renderer compatibility is detected during runtime
  connection and root inspection.

## Vite plugin injection ordering {#vite-plugin-injection-ordering}

The Vite plugin injects the DevTools client and bridge into served HTML. If the
client is missing, loads late, or reports **No React detected**, check plugin
ordering before looking deeper.

Recommended checks:

- Register the React DevTools Vite plugin in the same Vite config that serves
  the inspected page.
- Place it after framework plugins that transform React code, but before custom
  HTML middleware that rewrites or replaces the served document.
- If another plugin fully handles `transformIndexHtml`, confirm it preserves the
  injected DevTools tags.
- Confirm any configured append target exists in the served HTML. If the target
  is missing, the client cannot be inserted into the expected place.
- Restart the Vite dev server after changing plugin order. Hot reload cannot
  repair every HTML injection order problem.

Expected recovery: the served HTML should load the DevTools client early enough
that renderer injection and the first committed roots appear in Overview.

## Open in editor failures {#open-in-editor-failures}

The Vite delivery mode exposes a same-origin `__open-in-editor` endpoint for
source, asset, route, and module graph actions.

If an Open in editor action fails:

- Confirm the file path is inside the Vite project root. Requests outside the
  root are rejected.
- Confirm the configured editor command exists on the shell `PATH` used to start
  Vite.
- For VS Code-compatible commands, use `code`, `code-insiders`, or `codium` so
  line and column arguments are formatted as an editor location.
- If a custom command is configured, verify its argument template includes
  `{file}` or `{location}`.
- Watch the Vite server console for `[react-devtools] Failed to open editor`.

Expected recovery: the endpoint returns `202` with the command, arguments, and
resolved file when the launch request is accepted.

## Extension CSP and permissions problems {#extension-csp-and-permissions}

The extension intentionally keeps its permission and Content Security Policy
surface small. Some pages and features are therefore blocked by design.

Expected constraints:

- Chrome uses `activeTab` and `scripting`; Firefox uses `activeTab`.
- The extension does not request persistent host permissions.
- Content scripts target ordinary HTTP and HTTPS pages.
- Extension pages block remote code, inline script, inline style, eval, objects,
  and embedding by another page.

If the popup stays disabled or the panel cannot load:

- Move from a browser-owned page to an ordinary application page.
- Reopen browser DevTools after installing or updating the extension.
- Confirm the extension manifest still declares the expected minimum
  permissions.
- Check whether the feature you are testing requires a local server or remote
  frame. That requires a focused manifest and CSP change, not a runtime
  workaround.

## Missing source locations {#missing-source-locations}

Some UI rows can render without source links or Open in editor actions. That is
valid when the inspected runtime cannot provide a reliable source location.

Common causes:

- Production builds, minifiers, or source map settings removed file, line, or
  column metadata.
- React component stacks only include display names, not file locations.
- Route adapters, store adapters, or asset graph records omitted source fields.
- The selected item comes from generated code, virtual modules, or a dependency
  outside the project root.

Recovery options:

- Reproduce in development mode with source maps enabled.
- Check whether the relevant adapter includes source metadata in its snapshot.
- Use the Module Graph or Assets views to confirm the file exists in Vite's
  graph before expecting Open in editor to appear.
- Keep source paths project-root relative or absolute paths inside the project
  root so Vite can validate them.
