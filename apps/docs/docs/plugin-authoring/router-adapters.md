---
title: Router Adapters
---

# Router Adapters

Router adapters normalize framework routers into one contract for the React DevTools route inspector. Adapters should expose a route tree, the current route, and optional actions for opening source files or navigating to a route.

Register an adapter from a plugin setup function:

```ts
import { setupDevToolsPlugin } from '@devtools/api';

setupDevToolsPlugin({ id: 'routes', label: 'Routes' }, (api) => {
    api.registerRouterAdapter({
        getCurrentRoute() {
            return {
                fullPath: '/teams/react?tab=activity',
                matchedNodeIds: ['teams', 'team-detail'],
                params: { teamId: 'react' },
                pathname: '/teams/react',
                query: { tab: 'activity' },
                search: '?tab=activity'
            };
        },
        getRouteTree() {
            return [
                {
                    actions: [
                        {
                            source: {
                                file: 'src/routes/teams.$teamId.tsx',
                                line: 12
                            },
                            type: 'open-file'
                        },
                        {
                            to: '/teams/react',
                            type: 'navigate'
                        }
                    ],
                    fullPath: '/teams/:teamId',
                    id: 'team-detail',
                    label: 'Team Detail',
                    path: ':teamId',
                    segmentType: 'dynamic'
                }
            ];
        },
        id: 'react-router',
        kind: 'react-router',
        label: 'React Router'
    });
});
```

Adapters should keep node IDs stable across updates. `fullPath` should represent the route pattern, while `RouterCurrentRoute.fullPath` should represent the browser location including search and hash. Use `source` and `open-file` actions when a route maps to a known file, and use `navigate` actions only when the router can safely navigate programmatically.
