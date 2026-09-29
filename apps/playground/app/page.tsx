import Link from 'next/link';

export default function HomePage() {
    return (
        <main>
            <h1>React DevTools Playground</h1>
            <p>
                A development playground for exercising React DevTools behavior
                through both Next.js routers.
            </p>
            <nav>
                <Link href="/app-demo">App Router demo</Link>
                <Link href="/app-demo/react">App Router dynamic route</Link>
                <Link href="/pages-demo">Pages Router demo</Link>
                <Link href="/pages-demo/devtools">
                    Pages Router dynamic route
                </Link>
            </nav>
        </main>
    );
}
