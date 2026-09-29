---
title: Plugin Authoring
---

# Plugin Authoring

Plugins extend React DevTools with framework, router, store, and product-specific debugging surfaces. The public API is intentionally small:

- Use [store adapters](./store-adapters.md) for library-owned state trees and editable state.
- Use [router adapters](./router-adapters.md) for route tables, current route state, and navigation actions.
- Use custom tabs only when your integration needs a full product surface that does not fit the tree/state inspector model.
- Use timeline layers for temporal events such as actions, cache invalidations, network updates, or suspense transitions.

Every plugin starts with `setupDevToolsPlugin` from `@devtools/api`:

```ts
import { setupDevToolsPlugin } from '@devtools/api';

setupDevToolsPlugin(
    {
        id: 'my-library',
        label: 'My Library',
        packageName: '@my-library/devtools-plugin'
    },
    (api) => {
        api.notify('My Library DevTools plugin registered.');
    }
);
```

Prefer stable IDs, serializable metadata, and graceful fallbacks. DevTools should keep working when a library is partially initialized, an optional runtime API is unavailable, or a user is inspecting server-rendered markup before hydration completes.
