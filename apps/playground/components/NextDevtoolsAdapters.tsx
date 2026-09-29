'use client';

import {
    useRegisterNextAppRouterAdapter,
    useRegisterNextPagesRouterAdapter,
    type NextRouteDefinition
} from '@devtools/nextjs-plugin';

export const nextPlaygroundRoutes: NextRouteDefinition[] = [
    {
        id: 'app-home',
        label: 'App Home',
        metadata: {
            fixture: 'next-playground'
        },
        mode: 'app',
        path: '/',
        source: {
            file: 'apps/playground/app/page.tsx'
        }
    },
    {
        children: [
            {
                id: 'app-demo-team',
                label: 'App Demo Team',
                metadata: {
                    routerMode: 'app'
                },
                path: '[teamId]',
                source: {
                    file: 'apps/playground/app/app-demo/[teamId]/page.tsx'
                }
            }
        ],
        id: 'app-demo',
        label: 'App Demo',
        mode: 'app',
        path: '/app-demo',
        source: {
            file: 'apps/playground/app/app-demo/page.tsx'
        }
    },
    {
        id: 'pages-demo',
        label: 'Pages Demo',
        metadata: {
            routerMode: 'pages'
        },
        mode: 'pages',
        path: '/pages-demo',
        source: {
            file: 'apps/playground/pages/pages-demo/index.tsx'
        }
    },
    {
        id: 'pages-demo-team',
        label: 'Pages Demo Team',
        metadata: {
            routerMode: 'pages'
        },
        mode: 'pages',
        path: '/pages-demo/[teamId]',
        source: {
            file: 'apps/playground/pages/pages-demo/[teamId].tsx'
        }
    }
];

export function NextAppRouterDevtoolsRegistration() {
    useRegisterNextAppRouterAdapter({
        adapterId: 'nextjs-app-router-playground',
        adapterLabel: 'Next.js App Router Playground',
        pluginId: 'nextjs-playground',
        pluginLabel: 'Next.js Playground',
        routes: nextPlaygroundRoutes
    });

    return null;
}

export function NextPagesRouterDevtoolsRegistration() {
    useRegisterNextPagesRouterAdapter({
        adapterId: 'nextjs-pages-router-playground',
        adapterLabel: 'Next.js Pages Router Playground',
        pluginId: 'nextjs-playground',
        pluginLabel: 'Next.js Playground',
        routes: nextPlaygroundRoutes
    });

    return null;
}
