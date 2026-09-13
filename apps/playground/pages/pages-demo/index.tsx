import type { InferGetServerSidePropsType } from 'next';
import Link from 'next/link';

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
                Legacy store demos were removed. Plain React demo coverage will
                land here next.
            </p>
        </main>
    );
}
