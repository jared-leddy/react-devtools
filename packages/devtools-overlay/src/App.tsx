import { useEffect, useMemo, useRef, useState } from 'react';
import {
    DEFAULT_CLIENT_URL,
    createLazyIframeController,
    type IframeTransport
} from './iframeTransport';
import './style.css';

const SOURCE_METADATA_ATTRIBUTE = 'data-react-devtools-source';
const COMPONENT_ID_ATTRIBUTE = 'data-react-devtools-component-id';
const ROOT_ID_ATTRIBUTE = 'data-react-devtools-root-id';

export interface InspectOverlayTarget {
    componentId?: string;
    displayName?: string;
    domRect: {
        height: number;
        width: number;
        x: number;
        y: number;
    };
    rootId?: string;
    source?: {
        columnNumber: number;
        fileName: string;
        lineNumber: number;
    };
}

export interface DevtoolsOverlayProps {
    clientUrl?: string;
    defaultOpen?: boolean;
    defaultInspecting?: boolean;
    onConnect?: (transport: IframeTransport) => void | Promise<void>;
    onInspectTarget?: (target: InspectOverlayTarget) => void | Promise<void>;
    onToggle?: (open: boolean) => void;
    resolveInspectTarget?: (
        element: Element
    ) => InspectOverlayTarget | null | undefined;
}

export function DevtoolsOverlay({
    clientUrl = DEFAULT_CLIENT_URL,
    defaultOpen = false,
    defaultInspecting = false,
    onConnect,
    onInspectTarget,
    onToggle,
    resolveInspectTarget = resolveDefaultInspectTarget
}: DevtoolsOverlayProps) {
    const [open, setOpen] = useState(defaultOpen);
    const [inspecting, setInspecting] = useState(defaultInspecting);
    const [hoverTarget, setHoverTarget] = useState<InspectOverlayTarget | null>(
        null
    );
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

    function toggleInspectMode() {
        setInspecting((currentInspecting) => !currentInspecting);
    }

    useEffect(() => {
        if (!inspecting) {
            setHoverTarget(null);
            return undefined;
        }

        function resolveEventTarget(event: Event) {
            const target = event.target;

            if (!(target instanceof Element)) {
                return null;
            }

            if (target.closest('.react-devtools-overlay')) {
                return null;
            }

            return resolveInspectTarget(target) ?? null;
        }

        function handlePointerMove(event: PointerEvent) {
            setHoverTarget(resolveEventTarget(event));
        }

        function handleClick(event: MouseEvent) {
            const target = resolveEventTarget(event);

            if (!target) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            setInspecting(false);
            setHoverTarget(null);
            void onInspectTarget?.(target);
            void iframeController.connect().then(() =>
                iframeController.getIframe().contentWindow?.postMessage(
                    {
                        method: 'selectInspectTarget',
                        payload: target,
                        type: 'react-devtools:inspect-target'
                    },
                    '*'
                )
            );
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setInspecting(false);
                setHoverTarget(null);
            }
        }

        function handleBlur() {
            setInspecting(false);
            setHoverTarget(null);
        }

        window.addEventListener('pointermove', handlePointerMove, true);
        window.addEventListener('click', handleClick, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('blur', handleBlur, true);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove, true);
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('blur', handleBlur, true);
        };
    }, [iframeController, inspecting, onInspectTarget, resolveInspectTarget]);

    return (
        <div
            className="react-devtools-overlay"
            data-inspecting={inspecting}
            data-open={open}
            data-testid="react-devtools-overlay"
        >
            {hoverTarget ? (
                <div
                    aria-hidden="true"
                    className="react-devtools-overlay__inspect-box"
                    data-testid="react-devtools-inspect-box"
                    style={{
                        height: hoverTarget.domRect.height,
                        left: hoverTarget.domRect.x,
                        top: hoverTarget.domRect.y,
                        width: hoverTarget.domRect.width
                    }}
                />
            ) : null}
            <button
                aria-label="Toggle inspect mode"
                aria-pressed={inspecting}
                className="react-devtools-overlay__inspect-toggle"
                onClick={toggleInspectMode}
                title="Inspect React component"
                type="button"
            >
                <span aria-hidden="true">I</span>
            </button>
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

export function resolveDefaultInspectTarget(
    element: Element
): InspectOverlayTarget | null {
    const inspectElement = element.closest(
        `[${COMPONENT_ID_ATTRIBUTE}], [${SOURCE_METADATA_ATTRIBUTE}]`
    );

    if (!inspectElement) {
        return null;
    }

    const rect = inspectElement.getBoundingClientRect();
    const source = parseSourceLocation(
        inspectElement.getAttribute(SOURCE_METADATA_ATTRIBUTE)
    );
    const componentId = inspectElement.getAttribute(COMPONENT_ID_ATTRIBUTE);
    const rootId = inspectElement.getAttribute(ROOT_ID_ATTRIBUTE);

    return {
        componentId: componentId ?? undefined,
        displayName:
            inspectElement.getAttribute('data-react-devtools-display-name') ??
            inspectElement.tagName.toLocaleLowerCase(),
        domRect: {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y
        },
        rootId: rootId ?? undefined,
        source
    };
}

function parseSourceLocation(
    value: null | string
): InspectOverlayTarget['source'] {
    if (!value) {
        return undefined;
    }

    const [column, line, ...fileParts] = value.split(':').reverse();
    const columnNumber = Number(column);
    const lineNumber = Number(line);
    const fileName = fileParts.reverse().join(':');

    if (
        !fileName ||
        !Number.isFinite(lineNumber) ||
        !Number.isFinite(columnNumber)
    ) {
        return undefined;
    }

    return {
        columnNumber,
        fileName,
        lineNumber
    };
}
