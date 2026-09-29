import type { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { PlainReactDemos } from '../../components/PlainReactDemos';

export const getServerSideProps = async ({
    params
}: {
    params?: { teamId?: string };
}) => {
    return {
        props: {
            teamId: params?.teamId ?? 'unknown'
        }
    };
};

export default function PagesTeamDemoPage({
    teamId
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
    return (
        <main>
            <p>
                <Link href="/pages-demo">← pages demo</Link>
            </p>
            <h1>Pages Router team demo</h1>
            <p data-testid="pages-router-team-route">
                Pages Router dynamic route for {teamId}.
            </p>
            <PlainReactDemos />
        </main>
    );
}
