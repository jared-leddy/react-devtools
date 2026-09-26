import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
    children,
    type = 'button',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button type={type} {...props}>
            {children}
        </button>
    );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
}
