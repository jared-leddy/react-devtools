import type { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { ActivityLog } from '../../components/ActivityLog';
import { CounterDemo } from '../../components/CounterDemo';
import { TodoDemo } from '../../components/TodoDemo';

export const getServerSideProps = async () => {
    return { props: {} };
};

export default function PagesDemoPage(
    _props: InferGetServerSidePropsType<typeof getServerSideProps>
) {
    return (
        <main>
            <p>
                <Link href="/">← home</Link>
            </p>
            <h1>Pages Router demo</h1>
            <p>
                getServerSideProps keeps this route rendered through the Pages
                Router while the old store demos are being removed.
            </p>
            <CounterDemo />
            <TodoDemo />
            <ActivityLog />
        </main>
    );
}
