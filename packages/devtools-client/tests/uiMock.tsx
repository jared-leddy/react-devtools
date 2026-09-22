import type { ReactNode } from 'react';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export function Card({
    children,
    title
}: {
    children: ReactNode;
    title: ReactNode;
}) {
    return (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    return <div data-theme="dark">{children}</div>;
}
