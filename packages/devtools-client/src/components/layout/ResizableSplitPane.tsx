import type { PointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface ResizableSplitPaneProps {
    defaultRatio?: number;
    left: ReactNode;
    leftLabel: string;
    maxRatio?: number;
    minRatio?: number;
    right: ReactNode;
    rightLabel: string;
    storageKey?: string;
}

const DEFAULT_RATIO = 0.42;
const DEFAULT_MIN_RATIO = 0.24;
const DEFAULT_MAX_RATIO = 0.76;

export function ResizableSplitPane({
    defaultRatio = DEFAULT_RATIO,
    left,
    leftLabel,
    maxRatio = DEFAULT_MAX_RATIO,
    minRatio = DEFAULT_MIN_RATIO,
    right,
    rightLabel,
    storageKey
}: ResizableSplitPaneProps) {
    const dividerId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [ratio, setRatio] = useState(() =>
        readStoredRatio(storageKey, defaultRatio, minRatio, maxRatio)
    );
    const [isResizing, setIsResizing] = useState(false);

    const updateRatio = useCallback(
        (clientX: number) => {
            const rect = containerRef.current?.getBoundingClientRect();

            if (!rect || rect.width <= 0 || !Number.isFinite(clientX)) {
                return;
            }

            setRatio(
                clampRatio(
                    (clientX - rect.left) / rect.width,
                    minRatio,
                    maxRatio
                )
            );
        },
        [maxRatio, minRatio]
    );

    useEffect(() => {
        if (storageKey) {
            window.localStorage.setItem(storageKey, String(ratio));
        }
    }, [ratio, storageKey]);

    useEffect(() => {
        if (!isResizing) {
            return;
        }

        const handlePointerMove = (event: globalThis.PointerEvent) => {
            updateRatio(event.clientX);
        };
        const handlePointerUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isResizing, updateRatio]);

    const leftPercent = ratio * 100;
    const rightPercent = 100 - leftPercent;

    return (
        <section
            aria-label="Resizable split pane"
            className={`dt-split-pane${isResizing ? ' dt-split-pane--resizing' : ''}`}
            ref={containerRef}
        >
            <section
                aria-label={leftLabel}
                className="dt-split-pane__pane dt-split-pane__pane--left"
                style={{ flexBasis: `${leftPercent}%` }}
            >
                {left}
            </section>
            <button
                aria-label="Resize panes"
                aria-orientation="vertical"
                aria-valuemax={Math.round(maxRatio * 100)}
                aria-valuemin={Math.round(minRatio * 100)}
                aria-valuenow={Math.round(leftPercent)}
                className="dt-split-pane__divider"
                id={dividerId}
                onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    setIsResizing(true);
                    updateRatio(event.clientX);
                }}
                role="separator"
                type="button"
            />
            <section
                aria-label={rightLabel}
                className="dt-split-pane__pane dt-split-pane__pane--right"
                style={{ flexBasis: `${rightPercent}%` }}
            >
                {right}
            </section>
        </section>
    );
}

function readStoredRatio(
    storageKey: string | undefined,
    fallback: number,
    minRatio: number,
    maxRatio: number
): number {
    if (!storageKey || typeof window === 'undefined') {
        return clampRatio(fallback, minRatio, maxRatio);
    }

    const storedValue = window.localStorage.getItem(storageKey);

    if (storedValue === null) {
        return clampRatio(fallback, minRatio, maxRatio);
    }

    const storedRatio = Number(storedValue);

    if (!Number.isFinite(storedRatio)) {
        return clampRatio(fallback, minRatio, maxRatio);
    }

    return clampRatio(storedRatio, minRatio, maxRatio);
}

function clampRatio(value: number, minRatio: number, maxRatio: number): number {
    return Math.min(Math.max(value, minRatio), maxRatio);
}
