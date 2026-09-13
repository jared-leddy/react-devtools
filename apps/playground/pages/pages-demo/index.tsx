import type { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';
import { PlainReactDemos } from '../../components/PlainReactDemos';

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
            <p>Plain React components rendered through the Pages Router.</p>
            <PlainReactDemos />
        </main>
    );
}
