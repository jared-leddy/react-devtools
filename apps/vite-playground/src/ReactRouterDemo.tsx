import {
    Link,
    MemoryRouter,
    Route,
    Routes,
    type RouteObject
} from 'react-router';
import { useRegisterReactRouterAdapter } from '@devtools/react-router-plugin';

export const reactRouterDemoRoutes: RouteObject[] = [
    {
        children: [
            {
                handle: {
                    devtools: {
                        label: 'Router Team Detail',
                        metadata: { playground: 'vite' },
                        source: {
                            file: 'apps/vite-playground/src/ReactRouterDemo.tsx',
                            line: 42
                        }
                    }
                },
                id: 'vite-team-detail',
                path: ':teamId'
            }
        ],
        handle: {
            devtools: {
                label: 'Router Teams'
            }
        },
        id: 'vite-teams',
        path: '/teams'
    },
    {
        handle: {
            devtools: {
                label: 'Router Settings'
            }
        },
        id: 'vite-settings',
        path: '/settings'
    }
];

export function ReactRouterDemo() {
    return (
        <MemoryRouter initialEntries={['/teams/react']}>
            <ReactRouterAdapterRegistration />
            <section aria-label="React Router fixtures">
                <h2>React Router fixtures</h2>
                <div className="router-fixture">
                    <nav aria-label="Router demo navigation">
                        <Link to="/teams/react">React team</Link>
                        <Link to="/teams/devtools">DevTools team</Link>
                        <Link to="/settings">Settings</Link>
                    </nav>
                    <Routes>
                        <Route path="/teams/:teamId" element={<TeamPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </div>
            </section>
        </MemoryRouter>
    );
}

function ReactRouterAdapterRegistration() {
    useRegisterReactRouterAdapter({
        adapterId: 'vite-react-router',
        adapterLabel: 'Vite React Router',
        pluginId: 'vite-react-router-demo',
        pluginLabel: 'Vite React Router Demo',
        routes: reactRouterDemoRoutes
    });

    return null;
}

function TeamPage() {
    return (
        <article className="card">
            <h3>Router team route</h3>
            <p data-testid="router-team-route">
                The Vite playground is exposing React Router route records.
            </p>
        </article>
    );
}

function SettingsPage() {
    return (
        <article className="card">
            <h3>Router settings route</h3>
            <p data-testid="router-settings-route">
                Settings route rendered through React Router.
            </p>
        </article>
    );
}
