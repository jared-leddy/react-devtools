---
sidebar_position: 1
---

# Installation

```bash
npm install @devtools/core
```

React 19 and React DOM 19 are peer dependencies — install them if your project doesn't already have them:

```bash
npm install react@^19 react-dom@^19
```

## Next.js

If you're using Next.js (Pages Router, App Router, or both), also install the adapter:

```bash
npm install @devtools/next
```

`@devtools/next` depends on `@devtools/core` and `next` (`^15.0.0 || ^16.0.0`) as peer dependencies. See [SSR & Next.js](../ssr/nextjs-pages-router.md) once you have a store defined.

## Not using Next.js?

You don't need `@devtools/next` at all. `@devtools/core` on its own works in any React app — Create React App, Vite, a plain client-rendered SPA. Wrap your app in a [`<NekutaStore>`](../api/nekuta-store.md) and start defining stores.

## Optional: enforcing one store style

`@devtools/eslint-plugin` lints for a single `defineStore()` style across your project — see [Enforcing a Store Style](../cookbook/enforcing-a-store-style.md).

```bash
npm install --save-dev @devtools/eslint-plugin
```
