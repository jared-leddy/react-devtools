import type { AppProps } from 'next/app';
import { NekutaAppProvider } from '../lib/nekuta-shim';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <NekutaAppProvider pageProps={pageProps}>
            <Component {...pageProps} />
        </NekutaAppProvider>
    );
}
