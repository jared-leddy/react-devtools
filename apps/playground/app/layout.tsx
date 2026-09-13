import { NekutaClientProvider } from '../lib/nekuta-shim';
import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata = {
    title: 'Nekuta Playground',
    description:
        'Live demo playground for React DevTools development across the Pages Router and the App Router.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <NekutaClientProvider>{children}</NekutaClientProvider>
            </body>
        </html>
    );
}
