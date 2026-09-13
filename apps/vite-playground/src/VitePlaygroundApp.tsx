import { PlainReactDemos } from './PlainReactDemos';

export function VitePlaygroundApp() {
    return (
        <main className="shell">
            <header className="hero">
                <p className="eyebrow">Vite delivery mode</p>
                <h1>React DevTools Vite Playground</h1>
                <p>
                    The same plain React fixture surface used by the Next.js
                    playground, served through Vite with the devtools plugin
                    active.
                </p>
            </header>
            <PlainReactDemos />
        </main>
    );
}
