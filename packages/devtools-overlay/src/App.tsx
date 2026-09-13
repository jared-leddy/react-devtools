import { useState } from 'react';
import './style.css';

export interface DevtoolsOverlayProps {
    defaultOpen?: boolean;
    onToggle?: (open: boolean) => void;
}

export function DevtoolsOverlay({
    defaultOpen = false,
    onToggle
}: DevtoolsOverlayProps) {
    const [open, setOpen] = useState(defaultOpen);

    function togglePanel() {
        setOpen((currentOpen) => {
            const nextOpen = !currentOpen;
            onToggle?.(nextOpen);
            return nextOpen;
        });
    }

    return (
        <div
            className="react-devtools-overlay"
            data-open={open}
            data-testid="react-devtools-overlay"
        >
            <button
                aria-pressed={open}
                aria-label="Toggle React DevTools panel"
                className="react-devtools-overlay__toggle"
                onClick={togglePanel}
                title="Toggle React DevTools"
                type="button"
            >
                <span
                    aria-hidden="true"
                    className="react-devtools-overlay__mark"
                >
                    R
                </span>
            </button>
        </div>
    );
}
