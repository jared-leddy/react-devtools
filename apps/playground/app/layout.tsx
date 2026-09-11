import { serializeNekutaState } from '@devtools/core';
import { getServerNekuta, NekutaClientProvider } from '@devtools/next';
import type { ReactNode } from 'react';
import { useCounterStore } from '../stores/counterStore';
import { useTodoStore } from '../stores/todoStore';
import '../styles/globals.css';

export const metadata = {
    title: 'Nekuta Playground',
    description:
        'Live demo of nekuta + @devtools/next across the Pages Router and the App Router.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
    const nekuta = getServerNekuta();

    // Touch both stores so their default state exists in the tree to serialize/hydrate — a real
    // app would instead populate them from actual server-side data here.
    useCounterStore(nekuta);
    useTodoStore(nekuta);

    const state = serializeNekutaState(nekuta);

    return (
        <html lang="en">
            <body>
                <NekutaClientProvider state={state}>
                    {children}
                </NekutaClientProvider>
            </body>
        </html>
    );
}
