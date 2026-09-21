import type { ReactNode } from 'react';
import { useId, useState } from 'react';

export interface TooltipProps {
    children: ReactNode;
    label: ReactNode;
}

export function Tooltip({ children, label }: TooltipProps) {
    const id = useId();
    const [visible, setVisible] = useState(false);

    return (
        <span
            className="dt-tooltip"
            onBlur={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <span
                aria-describedby={visible ? id : undefined}
                className="dt-tooltip__trigger"
            >
                {children}
            </span>
            {visible ? (
                <span className="dt-tooltip__bubble" id={id} role="tooltip">
                    {label}
                </span>
            ) : null}
        </span>
    );
}
