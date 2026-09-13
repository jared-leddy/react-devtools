import type { ReactNode } from 'react';
import '../styles/globals.css';

export const metadata = {
    title: 'React DevTools Playground',
    description:
        'Live demo playground for React DevTools development across the Pages Router and the App Router.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
