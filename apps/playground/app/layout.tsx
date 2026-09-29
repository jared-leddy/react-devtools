import { Suspense, type ReactNode } from 'react';
import { NextAppRouterDevtoolsRegistration } from '../components/NextDevtoolsAdapters';
import '../styles/globals.css';

export const metadata = {
    title: 'React DevTools Playground',
    description:
        'Live demo playground for React DevTools development across the Pages Router and the App Router.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Suspense fallback={null}>
                    <NextAppRouterDevtoolsRegistration />
                </Suspense>
                {children}
            </body>
        </html>
    );
}
