---
title: Vite Plugin
---

# Vite Plugin

The `@devtools/vite-plugin` package injects an embedded React DevTools overlay,
serves the standalone panel, and connects Vite's development features through a
namespaced websocket channel. It supports Vite 6, 7, and 8 through its peer
dependency range.

## Installation And Daily Workflow

In an existing Vite React application:

```bash
npm install -D @devtools/vite-plugin
```

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactDevtools } from '@devtools/vite-plugin';

export default defineConfig({
    plugins: [react(), reactDevtools()]
});
```

The default export is also `reactDevtools`. Keep your normal React plugin: the
DevTools plugin adds inspection, not React compilation. It runs with
`apply: 'serve'` and `enforce: 'pre'`, so its transforms run before ordinary
plugins regardless of this array order. It does not run during production builds.

Start your application's usual Vite development script, open the app, and use
the floating launcher or `Option+Shift+D` (`Alt+Shift+D` on other keyboards) to
toggle the overlay. Vite prints the standalone panel URL after listening, normally
`http://localhost:<port>/__devtools__/`. Open that URL for a separate panel.
The [install guide](../getting-started/overview.md#confirm-it-works) covers renderer,
root, and component checks.

The plugin serves the client and overlay builds from its dependencies. When
working in this monorepo, build those dependencies first with `npm run build`.
Do not point `clientDir` at the client source folder: it must contain the built
standalone `index.html` and assets.

## Configuration Reference

All options are optional. Feature options (`assets`, `graph`, `sourceMetadata`,
`componentInspector`, `openInEditor`) accept `false` or their options object;
omitting them enables defaults. Use `{}` for explicit defaults, not `true`.

| Option               | Type                                      | Default And Behavior                                                                                                                                         |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `appendTo`           | `string` or `RegExp`                      | Unset: inject a module script into HTML. When set, disable HTML injection and add the overlay import to matching browser modules instead.                    |
| `clientDir`          | `string`                                  | Resolve the installed `@devtools/client/style.css`, then use its sibling `standalone` directory. Supply an absolute directory for custom builds.             |
| `clientBasePath`     | `string`                                  | `/__devtools__/`, prefixed by Vite's `base`. Explicit paths are normalized with leading/trailing slashes and are not automatically prefixed by `base`.       |
| `printDevtoolsUrl`   | `boolean`                                 | `true`: print the first resolved local/network client URL and the shortcut hint. `false` suppresses both messages.                                           |
| `overlayDir`         | `string`                                  | Directory containing the resolved `@devtools/devtools-overlay` entry. Supply a built bundle directory for custom builds.                                     |
| `overlayBasePath`    | `string`                                  | `/__react-devtools-overlay__/`, prefixed by Vite's `base`. Explicit paths are normalized like `clientBasePath`.                                              |
| `overlayScriptPath`  | `string`                                  | Resolved overlay base path plus `devtools-overlay.js`. Explicit values are used verbatim; the URL must resolve to the actual bundle.                         |
| `onViteTransport`    | `(channel: ViteTransportChannel) => void` | Unset. Called during server configuration after the asset/graph handlers are installed; exposes `on(handler)` and `post(payload)` on the namespaced channel. |
| `assets`             | `false` or `ViteAssetExplorerOptions`     | Enabled with default asset listing, text preview, and watcher update events.                                                                                 |
| `graph`              | `false` or `ViteGraphExplorerOptions`     | Enabled with Vite's current module graph and watcher update events.                                                                                          |
| `sourceMetadata`     | `false` or `SourceMetadataOptions`        | Enabled: add `data-react-devtools-source` source locations to eligible JSX.                                                                                  |
| `componentInspector` | `false` or `ComponentInspectorOptions`    | Enabled: add component ID and display-name attributes for click-to-inspect.                                                                                  |
| `openInEditor`       | `false` or `OpenInEditorOptions`          | Enabled: install the `/__open-in-editor` endpoint.                                                                                                           |

### Source Metadata And Component Inspector

Only filenames ending in `.jsx`, `.tsx`, `.mjsx`, `.mtsx`, `.cjsx`, or `.ctsx`
qualify. Query strings are removed before matching; SSR transforms are skipped.
String filters use substring matching, not globs; regular expressions use `.test()`.
Avoid stateful `/g` or `/y` expressions. Exclude is checked before include.

| Nested Option                                 | Default And Behavior                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `sourceMetadata.attributeName`                | `data-react-devtools-source`; holds `file:line:column`.                                                |
| `sourceMetadata.include`                      | Unset: all eligible JSX filenames pass this feature's eligibility check. Accepts `string` or `RegExp`. |
| `sourceMetadata.exclude`                      | Unset. Accepts `string` or `RegExp`.                                                                   |
| `componentInspector.componentIdAttributeName` | `data-react-devtools-component-id`; encodes location and tag name.                                     |
| `componentInspector.displayNameAttributeName` | `data-react-devtools-display-name`; contains the JSX tag name.                                         |
| `componentInspector.include`                  | Unset; same matching rules as source metadata.                                                         |
| `componentInspector.exclude`                  | Unset; same matching rules as source metadata.                                                         |

The current implementation checks whether **either** feature qualifies a file,
then emits attributes for both enabled features. To exclude a file from all
annotations, use matching filters on both features or disable the other feature.
Custom attribute names are supported by the transform, but the shipped overlay
and client read the default names. Keep defaults for built-in inspection.
Custom JSX components must forward attributes to DOM elements for DOM-based
click inspection; fragments are not annotated.

```ts
import { reactDevtools } from '@devtools/vite-plugin';

const annotations = {
    include: /\/src\//,
    exclude: /\.test\.[jt]sx$/
};

export const inspectionPlugin = reactDevtools({
    sourceMetadata: annotations,
    componentInspector: annotations
});
```

### Asset Explorer

| `assets` Option    | Default And Behavior                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`             | Vite's configured root, falling back to the process working directory. Explicit paths resolve from the process working directory. Controls listing and permitted text-read paths. |
| `maxTextBytes`     | `65536` bytes (64 KiB). Text reads return a truncation flag when the file exceeds the limit. An RPC read request's `maxBytes` overrides this value.                               |
| `updateDebounceMs` | `80` milliseconds. Debounces add/change/unlink notifications from Vite's watcher.                                                                                                 |

Listings include project files, not only imported assets, and omit `.git`, `.next`,
`.turbo`, `build`, `coverage`, `dist`, `node_modules`, and common lockfiles.
Preview URLs use Vite's `/@fs/` path; changing `assets.root` does not itself
configure Vite's filesystem serving permissions or watcher roots. A listed image
can therefore still be unavailable for preview if Vite refuses that path.

### Module Graph

| `graph` Option     | Default And Behavior                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `root`             | Process working directory. Used for relative-path labels, not as a filter on graph modules or a replacement for Vite's project root. |
| `updateDebounceMs` | `80` milliseconds. Debounces Vite watcher add/change/unlink graph notifications.                                                     |

The graph contains modules Vite has encountered, rather than a scan of every
file. Open the app and load lazy routes before expecting those modules. Set
`graph.root` explicitly in a monorepo if labels should be relative to an app
directory. Traversal depth, direction, and root module are RPC request fields,
not plugin configuration options.

### Open In Editor

| `openInEditor` Option | Default And Behavior                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `command`             | First nonempty value from this option, `REACT_EDITOR`, `VISUAL`, `EDITOR`, or `code`. Supply an executable name/path, not a shell command containing flags.                                                                    |
| `args`                | For `code`, `code-insiders`, or `codium`: `['-g', '{location}']`; otherwise `['{location}']`. Each argument supports `{file}`, `{line}`, `{column}`, and `{location}` substitutions. Missing line/column become empty strings. |
| `launch`              | Optional `(command: string, args: string[]) => void \| Promise<void>` hook for embedders/tests. Overrides process spawning.                                                                                                    |

The endpoint accepts GET/HEAD with required `file` and optional positive integer
`line`/`column` query parameters. Paths must resolve inside Vite's project root;
`assets.root` and `graph.root` do not widen that boundary. The endpoint remains
`/__open-in-editor` even when Vite has a non-root `base`.
An accepted request returns `202`; asynchronous launch errors are logged by the
server, so acceptance does not prove an editor window opened. Use a local
development server for editor launching.

```ts
import { reactDevtools } from '@devtools/vite-plugin';

export const editorPlugin = reactDevtools({
    openInEditor: {
        command: 'code',
        args: ['--reuse-window', '-g', '{location}']
    }
});
```

## Apps Without A Vite HTML Entry

Use `appendTo` when another server/framework owns the HTML but Vite still serves
the browser entry module:

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactDevtools } from '@devtools/vite-plugin';

export default defineConfig({
    plugins: [react(), reactDevtools({ appendTo: '/src/main.tsx' })]
});
```

A string matches the **end** of the module filename. A regex tests the filename.
Neither accepts glob syntax. Query strings are stripped before matching. Choose
one browser entry, not every component. The transform prepends overlay config
and an import before the module's original code; it does not add markup to HTML.
If no module matches, the overlay will not mount because HTML injection is also
disabled. SSR modules are skipped, so choose a client entry actually loaded by
the browser. The overlay URLs must be reachable on the page's origin or through
your development proxy.

## Base Paths And Custom Bundles

With Vite `base: '/app/'` and no path overrides, the panel is
`/app/__devtools__/` and the overlay bundle is
`/app/__react-devtools-overlay__/devtools-overlay.js`. Default URLs follow the
pathname of an absolute Vite base; `./` is treated as `/` for DevTools serving.

Explicit overrides do not inherit Vite's base:

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import { reactDevtools } from '@devtools/vite-plugin';

export default defineConfig({
    base: '/app/',
    plugins: [
        reactDevtools({
            clientBasePath: '/app/debug/',
            overlayBasePath: '/app/debug-overlay/',
            printDevtoolsUrl: false
        })
    ]
});
```

This serves the panel at `/app/debug/` and uses
`/app/debug-overlay/devtools-overlay.js`. Paths are URL paths, not filesystem
directories. Changing `overlayScriptPath` only changes the injected import:
it does not rename a file or create another middleware mount. Keep it consistent
with `overlayBasePath` and the bundle filename.

Client middleware falls back to its built `index.html` for panel routes; overlay
middleware serves actual files only. Both copy `server.headers` from Vite, so
check those headers when debugging iframe or resource restrictions.

## Advanced Transport Hook

The callback receives a `ViteTransportChannel` with `on(handler)` for incoming
payloads and `post(payload)` for outgoing payloads. Payloads are JSON serialized
over `react-devtools:vite-transport-message`; use a unique message `type` and
ignore messages owned by other consumers. This is a server configuration hook,
not a browser plugin registration API. Use the
[plugin-authoring API](../plugin-authoring/overview.md) for custom inspectors.
It does not add client handling for arbitrary messages automatically, and the
channel has no public unsubscribe/dispose method.

## Troubleshooting

| Symptom                                          | Checks And Next Step                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay does not appear                          | Confirm you are using the dev server, not a production build or static preview. Without `appendTo`, inspect page HTML for the overlay module script. With `appendTo`, inspect the actual browser entry response for its import and check the suffix/regex. Check the console for module errors and the network response for `devtools-overlay.js`. |
| Overlay script is 404 or returns HTML            | Check `overlayDir` contains the built bundle. Check `overlayScriptPath` matches the mounted path and filename. Ensure a framework fallback or reverse proxy is not intercepting the DevTools routes.                                                                                                                                               |
| Panel is blank or its assets are 404             | Check the built standalone client directory and its `index.html`/assets. Rebuild dependencies in the monorepo. Check explicit base paths, proxy prefixes, and browser MIME errors.                                                                                                                                                                 |
| Overlay mounts but iframe is blocked             | Inspect CSP `frame-src`/`script-src` and frame response headers. Check Vite's `server.headers` and proxy-added policies. Preserve a same-origin client URL for the embedded plugin bridge.                                                                                                                                                         |
| No URL is printed                                | Check `printDevtoolsUrl` is not `false`. Printing requires an HTTP server and resolved Vite URLs after listening; middleware mode may not provide them. The client can still be served at its configured path.                                                                                                                                     |
| No React renderer or root                        | Ensure the app is loaded and React has mounted; refresh the inspected page. Follow [React detection troubleshooting](../troubleshooting.md#react-not-detected). The plugin cannot inspect an SSR-only page that has no client React root.                                                                                                          |
| Click inspection lacks source/component metadata | Verify the file is eligible JSX, enabled features and filters, default attribute names, and that custom components forward attributes to DOM nodes. Check both features' filters because eligibility is shared.                                                                                                                                    |
| Editor does not open                             | Confirm the executable is available to the Vite process, inspect server launch errors, and check the file is within Vite's root. A `202` response only confirms the launch request was accepted.                                                                                                                                                   |
| Asset/graph views are empty or stale             | Confirm the corresponding option is not `false`, the Vite websocket reaches the panel through the proxy, and the app has loaded modules. Check roots, filesystem access, and configured debounce intervals.                                                                                                                                        |

For broader transport and injection diagnostics, see
[troubleshooting](../troubleshooting.md) and the
[architecture overview](../architecture/overview.md).
