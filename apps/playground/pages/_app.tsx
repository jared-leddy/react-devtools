import type { AppProps } from 'next/app';
import { NextPagesRouterDevtoolsRegistration } from '../components/NextDevtoolsAdapters';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <NextPagesRouterDevtoolsRegistration />
            <Component {...pageProps} />
        </>
    );
}
