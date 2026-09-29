import { act, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { setupDevToolsPlugin } from '@devtools/api';
import type { RouteObject } from 'react-router';
import { MemoryRouter, useLocation } from 'react-router';
import {
    createReactRouterAdapter,
    createReactRouterCurrentRoute,
    createReactRouterRouteTree,
    useRegisterReactRouterAdapter
} from '../src/index.js';

const routes: RouteObject[] = [
    {
        children: [
            {
                handle: {
                    devtools: {
                        metadata: { owner: 'routes' },
                        source: {
                            file: 'src/routes/teams.$teamId.tsx',
                            line: 12
                        }
                    }
                },
                id: 'team-detail',
                path: ':teamId'
            }
        ],
        id: 'teams',
        path: '/teams'
    },
    {
        id: 'settings',
        path: '/settings'
    }
];

describe('@devtools/react-router-plugin', () => {
    beforeEach(() => {
        jest.mocked(setupDevToolsPlugin).mockReset();
    });

    it('normalizes React Router route objects into router route nodes', () => {
        const tree = createReactRouterRouteTree(routes, {
            pathname: '/teams/react'
        });

        expect(tree).toEqual([
            expect.objectContaining({
                children: [
                    expect.objectContaining({
                        actions: [
                            expect.objectContaining({ type: 'open-file' }),
                            expect.objectContaining({
                                to: '/teams/react',
                                type: 'navigate'
                            })
                        ],
                        fullPath: '/teams/:teamId',
                        id: 'team-detail',
                        isActive: true,
                        isExact: true,
                        params: { teamId: 'react' },
                        segmentType: 'dynamic'
                    })
                ],
                fullPath: '/teams',
                id: 'teams',
                isActive: true,
                segmentType: 'static'
            }),
            expect.objectContaining({
                fullPath: '/settings',
                id: 'settings',
                isActive: false
            })
        ]);
    });

    it('reports the current location and matched route chain', () => {
        expect(
            createReactRouterCurrentRoute(routes, {
                hash: '#state',
                pathname: '/teams/react',
                search: '?tab=activity',
                state: null
            })
        ).toEqual({
            fullPath: '/teams/react?tab=activity#state',
            hash: '#state',
            matchedNodeIds: ['teams', 'team-detail'],
            params: { teamId: 'react' },
            pathname: '/teams/react',
            query: { tab: 'activity' },
            search: '?tab=activity'
        });
    });

    it('covers layout, index, generated ids, catch-all, and trailing slash routes', () => {
        const tree = createReactRouterRouteTree(
            [
                {
                    children: [
                        {
                            index: true
                        },
                        {
                            path: 'reports/'
                        },
                        {
                            path: '*'
                        }
                    ]
                }
            ],
            { pathname: '/missing/path' }
        );

        expect(tree).toEqual([
            expect.objectContaining({
                fullPath: '/',
                id: 'root:0:/',
                label: 'Root route',
                segmentType: 'layout'
            })
        ]);
        expect(tree[0]?.children).toEqual([
            expect.objectContaining({
                fullPath: '/',
                label: 'Index route',
                segmentType: 'index'
            }),
            expect.objectContaining({
                fullPath: '/reports',
                label: 'reports/',
                segmentType: 'static'
            }),
            expect.objectContaining({
                fullPath: '/*',
                isActive: true,
                params: { '*': 'missing/path' },
                segmentType: 'catch-all'
            })
        ]);
    });

    it('notifies subscribers when navigation changes', () => {
        const listener = jest.fn();
        const navigate = jest.fn();
        const controller = createReactRouterAdapter({
            getLocation: () => ({
                hash: '',
                pathname: '/settings',
                search: '',
                state: null
            }),
            id: 'app-router',
            label: 'App Router',
            navigate,
            routes
        });
        const unsubscribe = controller.adapter.onRouteChange?.(listener);

        expect(controller.adapter.getSnapshot?.()).toEqual(
            expect.objectContaining({
                currentRoute: expect.objectContaining({
                    pathname: '/settings'
                }),
                rootNodes: expect.any(Array)
            })
        );
        controller.adapter.navigate?.({
            replace: true,
            to: '/teams/react'
        });
        controller.notifyRouteChange();
        unsubscribe?.();
        controller.notifyRouteChange();

        expect(controller.adapter.id).toBe('app-router');
        expect(controller.adapter.label).toBe('App Router');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('/teams/react', {
            replace: true
        });
        expect(controller.adapter.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                matchedNodeIds: ['settings'],
                pathname: '/settings'
            })
        );
    });

    it('registers a React Router adapter hook and navigates through React Router', async () => {
        const adapters: Array<{
            getCurrentRoute?: () => unknown;
            navigate?: (options: { to: string }) => void;
        }> = [];
        jest.mocked(setupDevToolsPlugin).mockImplementation(
            (_descriptor, setup) => {
                (
                    setup as (api: {
                        registerRouterAdapter(adapter: {
                            getCurrentRoute?: () => unknown;
                            navigate?: (options: { to: string }) => void;
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
            useRegisterReactRouterAdapter({
                adapterId: 'fixture-router',
                adapterLabel: 'Fixture Router',
                pluginId: 'fixture-plugin',
                pluginLabel: 'Fixture Plugin',
                routes
            });
            const location = useLocation();

            return createElement('p', null, location.pathname);
        }

        render(
            createElement(
                MemoryRouter,
                { initialEntries: ['/teams/react'] },
                createElement(Probe)
            )
        );

        expect(await screen.findByText('/teams/react')).toBeTruthy();
        expect(setupDevToolsPlugin).toHaveBeenCalledWith(
            {
                id: 'fixture-plugin',
                label: 'Fixture Plugin',
                packageName: '@devtools/react-router-plugin'
            },
            expect.any(Function)
        );
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                matchedNodeIds: ['teams', 'team-detail'],
                pathname: '/teams/react'
            })
        );

        act(() => {
            adapters[0]?.navigate?.({ to: '/settings' });
        });

        await waitFor(() => {
            expect(screen.getByText('/settings')).toBeTruthy();
        });
        expect(adapters[0]?.getCurrentRoute?.()).toEqual(
            expect.objectContaining({
                matchedNodeIds: ['settings'],
                pathname: '/settings'
            })
        );
    });
});
