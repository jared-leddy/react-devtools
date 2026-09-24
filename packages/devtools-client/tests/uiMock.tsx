import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

type ThemeMode = 'dark' | 'light';

const ThemeContext = createContext<{
    theme: ThemeMode;
    toggleTheme: () => void;
} | null>(null);

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
    const [theme, setTheme] = useState<ThemeMode>('dark');
    const value = useMemo(
        () => ({
            theme,
            toggleTheme: () => {
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
            }
        }),
        [theme]
    );

    return (
        <ThemeContext.Provider value={value}>
            <div className="dt-ui" data-theme={theme}>
                {children}
            </div>
        </ThemeContext.Provider>
    );
}

export function ThemeToggle() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('ThemeToggle must be used within ThemeProvider.');
    }

    return (
        <button onClick={context.toggleTheme}>
            {context.theme === 'dark' ? 'Dark' : 'Light'}
        </button>
    );
}
