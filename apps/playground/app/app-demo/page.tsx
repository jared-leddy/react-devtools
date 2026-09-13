'use client';

import Link from 'next/link';

export default function AppDemoPage() {
    return (
        <main>
            <p>
                <Link href="/">← home</Link>
            </p>
            <h1>App Router demo</h1>
            <p>
                Legacy store demos were removed. Plain React demo coverage will
                land here next.
            </p>
        </main>
    );
}
