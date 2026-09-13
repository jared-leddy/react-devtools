'use client';

import Link from 'next/link';
import { PlainReactDemos } from '../../components/PlainReactDemos';

export default function AppDemoPage() {
    return (
        <main>
            <p>
                <Link href="/">← home</Link>
            </p>
            <h1>App Router demo</h1>
            <p>Plain React components rendered through the App Router.</p>
            <PlainReactDemos />
        </main>
    );
}
