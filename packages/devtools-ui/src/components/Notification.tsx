import type { ReactNode } from 'react';
import { Button } from './Button';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export interface NotificationProps {
    children?: ReactNode;
    onClose?: () => void;
    title: ReactNode;
    tone?: NotificationTone;
}

export function Notification({
    children,
    onClose,
    title,
    tone = 'info'
}: NotificationProps) {
    return (
        <aside
            className={`dt-notification dt-notification--${tone}`}
            role="status"
        >
            <div className="dt-notification__content">
                <strong className="dt-notification__title">{title}</strong>
                {children ? (
                    <div className="dt-notification__body">{children}</div>
                ) : null}
            </div>
            {onClose ? (
                <Button
                    aria-label="Dismiss notification"
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                >
                    x
                </Button>
            ) : null}
        </aside>
    );
}
