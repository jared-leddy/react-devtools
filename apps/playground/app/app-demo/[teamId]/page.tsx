'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PlainReactDemos } from '../../../components/PlainReactDemos';

export default function AppTeamDemoPage() {
    const params = useParams<{ teamId: string }>();
    const teamId = params?.teamId ?? 'unknown';

    return (
        <main>
            <p>
                <Link href="/app-demo">← app demo</Link>
            </p>
            <h1>App Router team demo</h1>
            <p data-testid="app-router-team-route">
                App Router dynamic route for {teamId}.
            </p>
            <PlainReactDemos />
        </main>
    );
}
