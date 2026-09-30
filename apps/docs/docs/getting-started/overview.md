---
title: Getting Started
---

# Getting Started

React DevTools can be loaded through the Vite plugin during app development or
through the browser extension packages. Start with the Vite plugin when you
control the app's dev server; use the extension when you need to inspect an
ordinary HTTP/HTTPS page without changing that app's Vite config.

## Requirements

| Requirement                      | Supported versions                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React app                        | React 18 or newer is the supported target for adapters and playgrounds. React 19 is used by this repository's playgrounds and packages.                       |
| Vite delivery                    | Vite 6, 7, or 8 through `@devtools/vite-plugin` peer dependencies.                                                                                            |
| Chrome extension                 | Chrome 102 or newer. The current package is Manifest V3.                                                                                                      |
| Firefox extension                | Firefox 109 or newer. The current package uses Manifest V2 for the first verified Firefox path.                                                               |
| Page URL for extension detection | Ordinary `http://` or `https://` pages. Browser-owned pages, extension pages, Web Store pages, PDFs, and most privileged pages are intentionally unsupported. |

## Install In A Vite React App

These steps assume a blank Vite React project. Replace `my-app` with your app
name.

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install -D @devtools/vite-plugin
```

Add the plugin to `vite.config.ts`:

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reactDevtools from '@devtools/vite-plugin';

export default defineConfig({
    plugins: [react(), reactDevtools()]
});
```

Start Vite:

```bash
npm run dev
```

The dev server prints the React DevTools URL after startup. By default, the
standalone panel is served from:

```text
http://localhost:<vite-port>/__devtools__/
```

The floating overlay is injected into the app page. Use `Option+Shift+D` to
toggle it. You can also open the printed `__devtools__` URL in a separate tab.

## Confirm It Works

1. Open the Vite app URL in the browser.
2. Open the printed React DevTools URL, or toggle the overlay with
   `Option+Shift+D`.
3. Open the **Overview** tab.
4. Confirm the page shows at least one React renderer and one root.
5. Open **Components** and select a component from the tree.
6. Confirm the details pane updates with component metadata, props, state, or
   diagnostics when available.

If the panel says **No React detected**, refresh the app page after the Vite dev
server is running. If it still does not connect, see
[React not detected](../troubleshooting.md#react-not-detected) and
[Vite plugin injection ordering](../troubleshooting.md#vite-plugin-injection-ordering).

## Common Vite Options

Most apps can use `reactDevtools()` with no options. Reach for options only when
your app has a non-standard Vite shape.

```ts title="vite.config.ts"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reactDevtools from '@devtools/vite-plugin';

export default defineConfig({
    plugins: [
        react(),
        reactDevtools({
            printDevtoolsUrl: true,
            sourceMetadata: true,
            componentInspector: true,
            assets: true,
            graph: true,
            openInEditor: {
                command: 'code'
            }
        })
    ]
});
```

Useful options:

- `printDevtoolsUrl`: prints the standalone panel URL after Vite starts.
- `appendTo`: appends the overlay import to a module instead of injecting HTML.
  Use this for apps that do not serve an `index.html` entry.
- `sourceMetadata`: enables development-only component source annotations.
- `componentInspector`: enables click-to-inspect component metadata.
- `assets`: enables the Vite asset explorer RPC.
- `graph`: enables the Vite module graph RPC.
- `openInEditor`: enables the same-origin `__open-in-editor` endpoint used by
  source, asset, graph, and route actions.

## Install The Browser Extension Locally

The extension packages are available in this repository and can be loaded as
local development extensions. Use this path when you want browser DevTools
integration instead of Vite config integration.

### Chrome

```bash
git clone https://github.com/jared-leddy/react-devtools.git
cd react-devtools
npm install
npm run build --workspace @devtools/chrome-extension
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `packages/devtools-chrome-extension/dist`.
5. Open a React app on an `http://` or `https://` URL.
6. Open Chrome DevTools and select the **React** panel.

Chrome should show the extension as **React DevTools** with Manifest V3,
`activeTab`, and `scripting` permissions.

### Firefox

```bash
git clone https://github.com/jared-leddy/react-devtools.git
cd react-devtools
npm install
npm run build --workspace @devtools/firefox-extension
```

Then:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `packages/devtools-firefox-extension/dist/manifest.json`.
4. Open a React app on an `http://` or `https://` URL.
5. Open Firefox DevTools and select the **React** panel.

Firefox should load the temporary extension and show the rebuilt React panel for
detected pages.

## Package Extension Artifacts

To produce versioned ZIP artifacts for local review or store submission:

```bash
npm run extensions:package
```

Artifacts are written to `dist/extensions`:

- `react-devtools-chrome-extension-v<version>.zip`
- `react-devtools-chrome-extension-v<version>.zip.sha256`
- `react-devtools-firefox-extension-v<version>.zip`
- `react-devtools-firefox-extension-v<version>.zip.sha256`

See [Extension Release Packaging](../delivery-modes/extension-release.md) for
the full release flow.

## Blank-Project Checklist

Use this checklist when validating the install guide from scratch:

1. Create a fresh Vite React TypeScript app.
2. Install `@devtools/vite-plugin`.
3. Add `reactDevtools()` after the React plugin in `vite.config.ts`.
4. Start Vite and open the app.
5. Open the printed `__devtools__` URL.
6. Confirm **Overview** lists a renderer and root.
7. Confirm **Components** shows the app tree.
8. Select a component and confirm the details pane updates.
9. Trigger a component update in the app and confirm the tree/details refresh.
10. Use the troubleshooting page for any diagnostic state before filing a bug.
