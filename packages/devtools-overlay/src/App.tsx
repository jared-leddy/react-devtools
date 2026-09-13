import { useMemo, useRef, useState } from 'react';
import {
    DEFAULT_CLIENT_URL,
    createLazyIframeController,
    type IframeTransport
} from './iframeTransport';
import './style.css';

export interface DevtoolsOverlayProps {
    clientUrl?: string;
    defaultOpen?: boolean;
    onConnect?: (transport: IframeTransport) => void | Promise<void>;
    onToggle?: (open: boolean) => void;
}

export function DevtoolsOverlay({
    clientUrl = DEFAULT_CLIENT_URL,
    defaultOpen = false,
    onConnect,
    onToggle
}: DevtoolsOverlayProps) {
    const [open, setOpen] = useState(defaultOpen);
    const frameHostRef = useRef<HTMLDivElement>(null);
    const iframeController = useMemo(
        () => createLazyIframeController({ clientUrl, onConnect }),
        [clientUrl, onConnect]
    );

    function togglePanel() {
        setOpen((currentOpen) => {
            const nextOpen = !currentOpen;
            const iframe = iframeController.setVisible(nextOpen);

            if (
                frameHostRef.current &&
                !frameHostRef.current.contains(iframe)
            ) {
                frameHostRef.current.appendChild(iframe);
            }

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
            <div
                aria-hidden={!open}
                className="react-devtools-overlay__frame"
                data-testid="react-devtools-frame"
                ref={frameHostRef}
            />
        </div>
    );
}
