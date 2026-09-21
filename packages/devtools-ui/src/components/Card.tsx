import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    actions?: ReactNode;
    footer?: ReactNode;
    title?: ReactNode;
}

export function Card({
    actions,
    children,
    className = '',
    footer,
    title,
    ...props
}: CardProps) {
    return (
        <section className={`dt-card ${className}`.trim()} {...props}>
            {title || actions ? (
                <header className="dt-card__header">
                    {title ? (
                        <h2 className="dt-card__title">{title}</h2>
                    ) : (
                        <span />
                    )}
                    {actions ? (
                        <div className="dt-card__actions">{actions}</div>
                    ) : null}
                </header>
            ) : null}
            <div className="dt-card__body">{children}</div>
            {footer ? (
                <footer className="dt-card__footer">{footer}</footer>
            ) : null}
        </section>
    );
}
