import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: ReactNode;
    size?: ButtonSize;
    variant?: ButtonVariant;
}

export function Button({
    children,
    className = '',
    icon,
    size = 'md',
    type = 'button',
    variant = 'secondary',
    ...props
}: ButtonProps) {
    return (
        <button
            className={`dt-button dt-button--${variant} dt-button--${size} ${className}`.trim()}
            type={type}
            {...props}
        >
            {icon ? <span className="dt-button__icon">{icon}</span> : null}
            {children ? (
                <span className="dt-button__label">{children}</span>
            ) : null}
        </button>
    );
}
