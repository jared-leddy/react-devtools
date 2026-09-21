import type { ReactNode } from 'react';
import { useId } from 'react';
import { Button } from './Button';

export interface DialogProps {
    children: ReactNode;
    closeLabel?: string;
    description?: ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    title: ReactNode;
}

export function Dialog({
    children,
    closeLabel = 'Close dialog',
    description,
    onOpenChange,
    open,
    title
}: DialogProps) {
    const titleId = useId();
    const descriptionId = useId();

    if (!open) {
        return null;
    }

    return (
        <div className="dt-dialog" role="presentation">
            <button
                aria-label={closeLabel}
                className="dt-dialog__backdrop"
                onClick={() => onOpenChange(false)}
                type="button"
            />
            <section
                aria-describedby={description ? descriptionId : undefined}
                aria-labelledby={titleId}
                aria-modal="true"
                className="dt-dialog__panel"
                role="dialog"
            >
                <header className="dt-dialog__header">
                    <div>
                        <h2 className="dt-dialog__title" id={titleId}>
                            {title}
                        </h2>
                        {description ? (
                            <p
                                className="dt-dialog__description"
                                id={descriptionId}
                            >
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <Button
                        aria-label={closeLabel}
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        x
                    </Button>
                </header>
                <div className="dt-dialog__content">{children}</div>
            </section>
        </div>
    );
}
