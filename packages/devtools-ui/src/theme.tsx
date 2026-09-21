import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { Button } from './components/Button';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
    setTheme: (theme: ThemeMode) => void;
    theme: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
    children: ReactNode;
    defaultTheme?: ThemeMode;
}

export function ThemeProvider({
    children,
    defaultTheme = 'dark'
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<ThemeMode>(defaultTheme);
    const value = useMemo<ThemeContextValue>(
        () => ({
            setTheme,
            theme,
            toggleTheme: () =>
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
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

export function useTheme() {
    const value = useContext(ThemeContext);

    if (!value) {
        throw new Error('useTheme must be used within ThemeProvider.');
    }

    return value;
}

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            variant="ghost"
        >
            {theme === 'dark' ? 'Dark' : 'Light'}
        </Button>
    );
}
