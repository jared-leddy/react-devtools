import { MemoryRouter } from 'react-router';
import { Card, ThemeProvider } from '@devtools/ui';
import '@devtools/ui/style.css';
import './style.css';

export interface AppProps {
    router?: 'memory' | 'none';
}

function ClientShell() {
    return (
        <ThemeProvider>
            <main
                className="dt-client-shell"
                aria-label="React DevTools client"
            >
                <Card title="React DevTools">
                    <p className="dt-client-shell__copy">Client shell ready.</p>
                </Card>
            </main>
        </ThemeProvider>
    );
}

export function App({ router = 'memory' }: AppProps) {
    if (router === 'none') {
        return <ClientShell />;
    }

    return (
        <MemoryRouter>
            <ClientShell />
        </MemoryRouter>
    );
}
