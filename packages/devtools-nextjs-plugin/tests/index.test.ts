import { act, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { setupDevToolsPlugin } from '@devtools/api';
import {
    useParams,
    usePathname,
    useRouter as useAppRouter,
    useSearchParams,
    useSelectedLayoutSegments
} from 'next/navigation';
import { useRouter as usePagesRouter } from 'next/router';
import {
    createNextCurrentRoute,
    createNextRouteTree,
    createNextRouterAdapter,
    createNextRoutesFromManifests,
    useRegisterNextAppRouterAdapter,
    useRegisterNextPagesRouterAdapter,
    type NextRouteDefinition
} from '../src/index.js';

const routes: NextRouteDefinition[] = [
    {
        children: [
            {
                id: 'app-team',
                label: 'App Team',
                path: '[teamId]',
                source: {
                    file: 'app/app-demo/[teamId]/page.tsx',
                    line: 1
                }
            }
        ],
        id: 'app-demo',
        label: 'App Demo',
        mode: 'app',
        path: '/app-demo'
    },
    {
        id: 'pages-team',
        label: 'Pages Team',
        mode: 'pages',
        path: '/pages-demo/[teamId]',
        source: {
            file: 'pages/pages-demo/[teamId].tsx'
        }
    },
    {
        id: 'docs-catch-all',
        label: 'Docs Catch All',
        mode: 'app',
        path: '/docs/[...slug]'
    }
];

describe('@devtools/nextjs-plugin', () => {
    beforeEach(() => {
        jest.mocked(setupDevToolsPlugin).mockReset();
        jest.mocked(usePathname).mockReturnValue('/app-demo/react');
        jest.mocked(useParams).mockReturnValue({ teamId: 'react' });
        jest.mocked(useSearchParams).mockReturnValue(
            new URLSearchParams('tab=activity') as never
        );
        jest.mocked(useSelectedLayoutSegments).mockReturnValue([
            'app-demo',
            'react'
        ]);
        jest.mocked(useAppRouter).mockReturnValue({
            push: jest.fn(),
            replace: jest.fn()
        } as never);
        jest.mocked(usePagesRouter).mockReturnValue({
            asPath: '/pages-demo/devtools?tab=state#details',
            pathname: '/pages-demo/[teamId]',
            push: jest.fn(),
            query: { teamId: 'devtools' },
            replace: jest.fn(),
            route: '/pages-demo/[teamId]'
        } as never);
    });

    it('normalizes Next route definitions for the App Router', () => {
        const tree = createNextRouteTree(
            routes,
            { pathname: '/app-demo/react' },
            { mode: 'app' }
        );

        expect(tree).toEqual([
            expect.objectContaining({
                children: [
                    expect.objectContaining({
                        actions: [
                            expect.objectContaining({ type: 'open-file' }),
                            expect.objectContaining({
                                to: '/app-demo/react',
                                type: 'navigate'
                            })
                        ],
                        fullPath: '/app-demo/[teamId]',
                        id: 'app-team',
                        isActive: true,
                        isExact: true,
                        params: { teamId: 'react' },
                        segmentType: 'dynamic'
                    })
                ],
                fullPath: '/app-demo',
                id: 'app-demo',
                isActive: true,
                segmentType: 'static'
            }),
            expect.objectContaining({
                fullPath: '/docs/[...slug]',
                id: 'docs-catch-all',
                isActive: false,
                segmentType: 'catch-all'
            })
        ]);
    });

    it('reports current route params, search params, and matched route chain', () => {
        expect(
            createNextCurrentRoute(
                routes,
                {
                    hash: '#details',
                    pathname: '/pages-demo/devtools',
                    query: { injected: 'yes' },
                    search: '?tab=state'
                },
                { mode: 'pages' }
            )
        ).toEqual({
            fullPath: '/pages-demo/devtools?tab=state#details',
            hash: '#details',
            matchedNodeIds: ['pages-team'],
            params: { injected: 'yes', teamId: 'devtools' },
            pathname: '/pages-demo/devtools',
            query: { injected: 'yes', tab: 'state' },
            search: '?tab=state'
        });
    });

    it('builds fallback route records from Next manifests', () => {
        expect(
            createNextRoutesFromManifests({
                appPathRoutesManifest: {
                    'app/app-demo/page.js': '/app-demo'
                },
                pagesManifest: {
                    '/_app': 'pages/_app.js',
                    '/pages-demo': 'pages/pages-demo/index.js'
                },
                routesManifest: {
                    dynamicRoutes: [
                        {
                            page: '/pages-demo/[teamId]',
                            regex: '^/pages-demo/([^/]+?)(?:/)?$'
                        }
                    ],
                    staticRoutes: [{ page: '/pages-demo' }]
                }
            })
        ).toEqual([
            expect.objectContaining({
                id: 'app:/app-demo',
                mode: 'app',
                path: '/app-demo'
            }),
            expect.objectContaining({
                id: 'pages:/pages-demo',
                metadata: expect.objectContaining({
                    routeManifestKind: 'static'
                }),
                mode: 'pages',
                path: '/pages-demo'
            }),
            expect.objectContaining({
                id: 'pages:/pages-demo/[teamId]',
                metadata: expect.objectContaining({
                    regex: '^/pages-demo/([^/]+?)(?:/)?$',
                    routeManifestKind: 'dynamic'
                }),
                mode: 'pages',
                path: '/pages-demo/[teamId]'
            })
        ]);
    });

    it('covers Next route edge cases and fallback labels', () => {
        const edgeRoutes: NextRouteDefinition[] = [
            {
                mode: 'app',
                path: '/'
            },
            {
                id: 'marketing-group',
                mode: 'app',
                path: '/(marketing)'
            },
            {
                id: 'optional-shop',
                mode: 'app',
                path: '/shop/[[...slug]]'
            },
            {
                id: 'legacy-rest',
                mode: 'app',
                path: '/legacy/...'
            },
            {
                id: 'blog-slug',
                mode: 'app',
                path: '/blog/[slug]'
            }
        ];

        expect(
            createNextRouteTree(edgeRoutes, { pathname: '/' }, { mode: 'app' })
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    fullPath: '/',
                    isActive: true,
                    label: 'Home',
                    segmentType: 'index'
                }),
                expect.objectContaining({
                    id: 'marketing-group',
                    segmentType: 'group'
                }),
                expect.objectContaining({
                    id: 'optional-shop',
                    segmentType: 'optional-catch-all'
                })
            ])
        );
        expect(
            createNextCurrentRoute(
                edgeRoutes,
                { pathname: '/legacy/a/b' },
                { mode: 'app' }
            )
        ).toEqual(
            expect.objectContaining({
                matchedNodeIds: ['legacy-rest'],
                params: { '...': 'a/b' }
            })
        );
        expect(
            createNextCurrentRoute(
                edgeRoutes,
                { pathname: '/missing/deep/path' },
                { mode: 'app' }
            )
        ).toEqual(
            expect.objectContaining({
                matchedNodeIds: [],
                params: {}
            })
        );
        expect(
            createNextRouteTree(
                edgeRoutes,
                { pathname: '/blog' },
                { mode: 'app' }
            )
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    actions: [],
                    id: 'blog-slug',
                    isActive: false
                })
            ])
        );
    });

    it('creates adapter snapshots and notifies subscribers', () => {
        const navigate = jest.fn();
        const listener = jest.fn();
        const controller = createNextRouterAdapter({
            getLocation: () => ({
                pathname: '/docs/getting-started/install'
            }),
            mode: 'app',
            navigate,
            routes
        });
        const unsubscribe = controller.adapter.onRouteChange?.(listener);

        expect(controller.adapter.getSnapshot?.()).toEqual(
            expect.objectContaining({
                currentRoute: expect.objectContaining({
                    matchedNodeIds: ['docs-catch-all'],
                    params: { slug: 'getting-started/install' }
                }),
                rootNodes: expect.any(Array)
            })
        );

        controller.adapter.navigate?.({
            replace: true,
            to: '/app-demo/react'
        });
        controller.notifyRouteChange();
        unsubscribe?.();
        controller.notifyRouteChange();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('/app-demo/react', {
            replace: true
        });
    });

    it('uses the default adapter label and supports adapters without navigation', () => {
        const controller = createNextRouterAdapter({
            getLocation: () => ({ pathname: '/' }),
            routes: [
                {
                    mode: 'app',
                    path: '/'
                }
            ]
        });

        expect(controller.adapter.id).toBe('nextjs-router');
        expect(controller.adapter.label).toBe('Next.js Router');
        expect(controller.adapter.navigate).toBeUndefined();
    });

    it('registers the App Router hook and navigates through next/navigation', async () => {
        const adapters: Array<{
            getCurrentRoute?: () => unknown;
            navigate?: (options: { replace?: boolean; to: string }) => void;
        }> = [];
        const push = jest.fn();
        const replace = jest.fn();
        jest.mocked(useAppRouter).mockReturnValue({ push, replace } as never);
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                (
                    setup as (api: {
                        registerRouterAdapter(adapter: {
                            getCurrentRoute?: () => unknown;
                            navigate?: (options: {
                                replace?: boolean;
                                to: string;
                            }) => void;
                        }): void;
                    }) => void
                )({
                    registerRouterAdapter(adapter) {
                        adapters.push(adapter);
                    }
                });
            }
        );

        function Probe() {
            useRegisterNextAppRouterAdapter({
                pluginId: 'next-app-test',
                routes
            });

            return createElement('p', null, 'app ready');
        }

        render(createElement(Probe));

        expect(await screen.findByText('app ready')).toBeTruthy();
        expect(setupDevToolsPlugin).toHaveBeenCalledWith(
            {
                id: 'next-app-test',
                label: 'Next.js Router',
                packageName: '@devtools/nextjs-plugin'
            },
            expect.any(Function)
        );
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                matchedNodeIds: ['app-demo', 'app-team'],
                pathname: '/app-demo/react',
                query: { tab: 'activity', teamId: 'react' }
            })
        );

        act(() => {
            adapters[0]?.navigate?.({ to: '/app-demo/devtools' });
            adapters[0]?.navigate?.({
                replace: true,
                to: '/app-demo/react'
            });
        });

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith('/app-demo/devtools');
        });
        expect(replace).toHaveBeenCalledWith('/app-demo/react');
    });

    it('registers the Pages Router hook and reads next/router state', async () => {
        const adapters: Array<{
            getCurrentRoute?: () => unknown;
            navigate?: (options: { replace?: boolean; to: string }) => void;
        }> = [];
        const push = jest.fn();
        const replace = jest.fn();
        jest.mocked(usePagesRouter).mockReturnValue({
            asPath: '/pages-demo/devtools?tab=state#details',
            pathname: '/pages-demo/[teamId]',
            push,
            query: { teamId: 'devtools' },
            replace,
            route: '/pages-demo/[teamId]'
        } as never);
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                (
                    setup as (api: {
                        registerRouterAdapter(adapter: {
                            getCurrentRoute?: () => unknown;
                            navigate?: (options: {
                                replace?: boolean;
                                to: string;
                            }) => void;
                        }): void;
                    }) => void
                )({
                    registerRouterAdapter(adapter) {
                        adapters.push(adapter);
                    }
                });
            }
        );

        function Probe() {
            useRegisterNextPagesRouterAdapter({
                pluginId: 'next-pages-test',
                routes
            });

            return createElement('p', null, 'pages ready');
        }

        render(createElement(Probe));

        expect(await screen.findByText('pages ready')).toBeTruthy();
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                hash: '#details',
                matchedNodeIds: ['pages-team'],
                pathname: '/pages-demo/devtools',
                query: { tab: 'state', teamId: 'devtools' }
            })
        );

        act(() => {
            adapters[0]?.navigate?.({ to: '/pages-demo/react' });
            adapters[0]?.navigate?.({
                replace: true,
                to: '/pages-demo/devtools'
            });
        });

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith('/pages-demo/react');
        });
        expect(replace).toHaveBeenCalledWith('/pages-demo/devtools');
    });

    it('handles nullable App Router search and segment state', async () => {
        const adapters: Array<{
            getCurrentRoute?: () => unknown;
        }> = [];
        jest.mocked(useSearchParams).mockReturnValue(null as never);
        jest.mocked(useSelectedLayoutSegments).mockReturnValue(null as never);
        jest.mocked(useParams).mockReturnValue({
            enabled: true,
            ignored: { nested: true },
            slug: ['a', 'b']
        } as never);
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                (
                    setup as (api: {
                        registerRouterAdapter(adapter: {
                            getCurrentRoute?: () => unknown;
                        }): void;
                    }) => void
                )({
                    registerRouterAdapter(adapter) {
                        adapters.push(adapter);
                    }
                });
            }
        );

        function Probe() {
            useRegisterNextAppRouterAdapter({
                routes: [
                    {
                        mode: 'app',
                        path: '/app-demo/[teamId]'
                    }
                ]
            });

            return createElement('p', null, 'nullable app state');
        }

        render(createElement(Probe));

        expect(await screen.findByText('nullable app state')).toBeTruthy();
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                query: {
                    enabled: true,
                    slug: 'a/b'
                },
                search: undefined
            })
        );
    });

    it('falls back to root when the Pages Router has no path state', async () => {
        const adapters: Array<{
            getCurrentRoute?: () => unknown;
        }> = [];
        jest.mocked(usePagesRouter).mockReturnValue({
            push: jest.fn(),
            query: {
                slug: ['docs', 'install']
            },
            replace: jest.fn()
        } as never);
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                (
                    setup as (api: {
                        registerRouterAdapter(adapter: {
                            getCurrentRoute?: () => unknown;
                        }): void;
                    }) => void
                )({
                    registerRouterAdapter(adapter) {
                        adapters.push(adapter);
                    }
                });
            }
        );

        function Probe() {
            useRegisterNextPagesRouterAdapter({
                routes: [
                    {
                        mode: 'pages',
                        path: '/'
                    }
                ]
            });

            return createElement('p', null, 'pages fallback state');
        }

        render(createElement(Probe));

        expect(await screen.findByText('pages fallback state')).toBeTruthy();
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                pathname: '/',
                query: {
                    slug: 'docs/install'
                },
                search: undefined
            })
        );
    });
});
