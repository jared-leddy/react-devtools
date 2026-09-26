import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent
} from 'react';
import {
    DEFAULT_CLIENT_URL,
    createLazyIframeController,
    type IframeTransport
} from './iframeTransport';
import './style.css';

const SOURCE_METADATA_ATTRIBUTE = 'data-react-devtools-source';
const COMPONENT_ID_ATTRIBUTE = 'data-react-devtools-component-id';
const ROOT_ID_ATTRIBUTE = 'data-react-devtools-root-id';
const OVERLAY_STORAGE_KEY = 'react-devtools.overlay.preferences';
const BASE_FRAME_BOUNDS: OverlayFrameBounds = {
    height: 620,
    left: 20,
    top: 20,
    width: 440
};
const MIN_FRAME_HEIGHT = 280;
const MIN_FRAME_WIDTH = 320;

export type OverlayDockSide = 'bottom' | 'floating' | 'right';

export interface OverlayFrameBounds {
    height: number;
    left: number;
    top: number;
    width: number;
}

export interface OverlayPreferences {
    bounds: OverlayFrameBounds;
    closeOnOutsideClick: boolean;
    dock: OverlayDockSide;
    keepMounted: boolean;
    minimizeDelay: number;
    minimized: boolean;
    open: boolean;
    openRoute: string;
    reduceMotion: boolean;
}

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
    closeOnOutsideClick?: boolean;
    defaultBounds?: Partial<OverlayFrameBounds>;
    defaultDock?: OverlayDockSide;
    defaultOpen?: boolean;
    defaultInspecting?: boolean;
    keepMounted?: boolean;
    minimizeDelay?: number;
    onConnect?: (transport: IframeTransport) => void | Promise<void>;
    onInspectTarget?: (target: InspectOverlayTarget) => void | Promise<void>;
    onToggle?: (open: boolean) => void;
    reduceMotion?: boolean;
    resolveInspectTarget?: (
        element: Element
    ) => InspectOverlayTarget | null | undefined;
    separateWindowUrl?: string;
    storageKey?: string;
    toggleShortcut?: string;
}

export function DevtoolsOverlay({
    clientUrl = DEFAULT_CLIENT_URL,
    closeOnOutsideClick = false,
    defaultBounds,
    defaultDock = 'floating',
    defaultOpen = false,
    defaultInspecting = false,
    keepMounted = false,
    minimizeDelay = 0,
    onConnect,
    onInspectTarget,
    onToggle,
    reduceMotion = false,
    resolveInspectTarget = resolveDefaultInspectTarget,
    separateWindowUrl,
    storageKey = OVERLAY_STORAGE_KEY,
    toggleShortcut = 'alt+shift+d'
}: DevtoolsOverlayProps) {
    const [preferences, setPreferences] = useState<OverlayPreferences>(() =>
        getInitialOverlayPreferences(storageKey, {
            bounds: { ...getDefaultFrameBounds(), ...defaultBounds },
            closeOnOutsideClick,
            dock: defaultDock,
            keepMounted,
            minimizeDelay,
            minimized: false,
            open: defaultOpen,
            openRoute: getClientRoute(clientUrl),
            reduceMotion
        })
    );
    const [inspecting, setInspecting] = useState(defaultInspecting);
    const [hoverTarget, setHoverTarget] = useState<InspectOverlayTarget | null>(
        null
    );
    const frameHostRef = useRef<HTMLDivElement>(null);
    const mountedIframeRef = useRef(false);
    const minimizeTimerRef = useRef<number | undefined>(undefined);
    const iframeController = useMemo(
        () => createLazyIframeController({ clientUrl, onConnect }),
        [clientUrl, onConnect]
    );
    const open = preferences.open;
    const minimized = preferences.minimized;
    const shouldMountIframe =
        preferences.keepMounted || preferences.open || defaultOpen;

    function updatePreferences(
        updater: (current: OverlayPreferences) => OverlayPreferences
    ) {
        setPreferences((currentPreferences) => {
            const nextPreferences = clampOverlayPreferences(
                updater(currentPreferences)
            );

            writeOverlayPreferences(storageKey, nextPreferences);
            return nextPreferences;
        });
    }

    function togglePanel() {
        updatePreferences((currentPreferences) => {
            const nextOpen = !currentPreferences.open;
            onToggle?.(nextOpen);
            return {
                ...currentPreferences,
                minimized: nextOpen ? false : currentPreferences.minimized,
                open: nextOpen
            };
        });
    }

    function toggleInspectMode() {
        setInspecting((currentInspecting) => !currentInspecting);
    }

    function closePanel() {
        updatePreferences((currentPreferences) => ({
            ...currentPreferences,
            open: false
        }));
        onToggle?.(false);
    }

    function minimizePanel() {
        if (preferences.minimizeDelay > 0) {
            window.clearTimeout(minimizeTimerRef.current);
            minimizeTimerRef.current = window.setTimeout(() => {
                updatePreferences((currentPreferences) => ({
                    ...currentPreferences,
                    minimized: true
                }));
            }, preferences.minimizeDelay);
            return;
        }

        updatePreferences((currentPreferences) => ({
            ...currentPreferences,
            minimized: true
        }));
    }

    function restorePanel() {
        window.clearTimeout(minimizeTimerRef.current);
        updatePreferences((currentPreferences) => ({
            ...currentPreferences,
            minimized: false,
            open: true
        }));
    }

    function dockPanel(dock: OverlayDockSide) {
        updatePreferences((currentPreferences) => ({
            ...currentPreferences,
            dock,
            minimized: false,
            open: true
        }));
    }

    function setBounds(bounds: OverlayFrameBounds) {
        updatePreferences((currentPreferences) => ({
            ...currentPreferences,
            bounds,
            dock: 'floating'
        }));
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

    useEffect(() => {
        if (!frameHostRef.current) {
            return;
        }

        if (!shouldMountIframe && !mountedIframeRef.current) {
            return;
        }

        const iframe = iframeController.setVisible(open && !minimized);
        mountedIframeRef.current = true;

        if (!frameHostRef.current.contains(iframe)) {
            frameHostRef.current.appendChild(iframe);
        }
    }, [iframeController, minimized, open, shouldMountIframe]);

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent) {
            if (!matchesShortcut(event, toggleShortcut)) {
                return;
            }

            event.preventDefault();
            togglePanel();
        }

        window.addEventListener('keydown', handleShortcut);

        return () => {
            window.removeEventListener('keydown', handleShortcut);
        };
    });

    useEffect(() => {
        if (!open || minimized || !preferences.closeOnOutsideClick) {
            return undefined;
        }

        function handlePointerDown(event: PointerEvent) {
            const target = event.target;

            if (
                target instanceof Element &&
                target.closest('.react-devtools-overlay')
            ) {
                return;
            }

            closePanel();
        }

        window.addEventListener('pointerdown', handlePointerDown, true);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown, true);
        };
    }, [minimized, open, preferences.closeOnOutsideClick]);

    useEffect(
        () => () => {
            window.clearTimeout(minimizeTimerRef.current);
        },
        []
    );

    const panelStyle = getPanelStyle(preferences);
    const separateWindowHref = separateWindowUrl ?? clientUrl;

    return (
        <div
            className="react-devtools-overlay"
            data-dock={preferences.dock}
            data-inspecting={inspecting}
            data-minimized={minimized}
            data-open={open}
            data-reduce-motion={preferences.reduceMotion}
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
                style={panelStyle}
            />
            {open ? (
                <section
                    aria-label="React DevTools panel controls"
                    className="react-devtools-overlay__panel"
                    data-minimized={minimized}
                    style={panelStyle}
                >
                    <div
                        className="react-devtools-overlay__toolbar"
                        onPointerDown={(event) => {
                            startPanelDrag(event, preferences, setBounds);
                        }}
                    >
                        <span className="react-devtools-overlay__title">
                            React DevTools
                        </span>
                        <div className="react-devtools-overlay__toolbar-actions">
                            <a
                                aria-label="Open React DevTools in separate window"
                                className="react-devtools-overlay__icon-link"
                                href={separateWindowHref}
                                rel="noreferrer"
                                target="_blank"
                                title="Open in separate window"
                            >
                                ↗
                            </a>
                            <button
                                aria-label="Dock React DevTools to bottom"
                                aria-pressed={preferences.dock === 'bottom'}
                                onClick={() => {
                                    dockPanel('bottom');
                                }}
                                title="Dock bottom"
                                type="button"
                            >
                                ▬
                            </button>
                            <button
                                aria-label="Dock React DevTools to right"
                                aria-pressed={preferences.dock === 'right'}
                                onClick={() => {
                                    dockPanel('right');
                                }}
                                title="Dock right"
                                type="button"
                            >
                                ▌
                            </button>
                            <button
                                aria-label="Undock React DevTools panel"
                                aria-pressed={preferences.dock === 'floating'}
                                onClick={() => {
                                    dockPanel('floating');
                                }}
                                title="Undock"
                                type="button"
                            >
                                □
                            </button>
                            <button
                                aria-label="Minimize React DevTools panel"
                                onClick={minimizePanel}
                                title="Minimize"
                                type="button"
                            >
                                _
                            </button>
                            <button
                                aria-label="Close React DevTools panel"
                                onClick={closePanel}
                                title="Close"
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    {minimized ? (
                        <button
                            aria-label="Restore React DevTools panel"
                            className="react-devtools-overlay__restore"
                            onClick={restorePanel}
                            type="button"
                        >
                            Restore
                        </button>
                    ) : (
                        <div
                            aria-label="Resize React DevTools panel"
                            className="react-devtools-overlay__resize"
                            onPointerDown={(event) => {
                                startPanelResize(event, preferences, setBounds);
                            }}
                            role="separator"
                        />
                    )}
                </section>
            ) : null}
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

function getInitialOverlayPreferences(
    storageKey: string,
    defaults: Omit<OverlayPreferences, 'bounds'> & {
        bounds: OverlayFrameBounds;
    }
): OverlayPreferences {
    const persisted = readOverlayPreferences(storageKey);

    return clampOverlayPreferences({
        ...defaults,
        ...persisted,
        bounds: {
            ...defaults.bounds,
            ...persisted?.bounds
        }
    });
}

function readOverlayPreferences(
    storageKey: string
): Partial<OverlayPreferences> | undefined {
    try {
        const storedValue = window.localStorage.getItem(storageKey);

        if (!storedValue) {
            return undefined;
        }

        const parsed = JSON.parse(storedValue) as Partial<OverlayPreferences>;

        return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function writeOverlayPreferences(
    storageKey: string,
    preferences: OverlayPreferences
): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
        // Storage can be unavailable in private browsing or embedded contexts.
    }
}

function clampOverlayPreferences(
    preferences: OverlayPreferences
): OverlayPreferences {
    const bounds = preferences.bounds;

    return {
        ...preferences,
        bounds: {
            height: clampFiniteNumber(bounds.height, MIN_FRAME_HEIGHT),
            left: clampFiniteNumber(bounds.left, 8),
            top: clampFiniteNumber(bounds.top, 8),
            width: clampFiniteNumber(bounds.width, MIN_FRAME_WIDTH)
        },
        dock: isOverlayDockSide(preferences.dock)
            ? preferences.dock
            : 'floating',
        minimizeDelay: Math.max(0, Math.round(preferences.minimizeDelay))
    };
}

function clampFiniteNumber(value: number, min: number): number {
    const rounded = Math.round(value);

    return Number.isFinite(rounded) ? Math.max(min, rounded) : min;
}

function getDefaultFrameBounds(): OverlayFrameBounds {
    if (typeof window === 'undefined') {
        return BASE_FRAME_BOUNDS;
    }

    return {
        ...BASE_FRAME_BOUNDS,
        left: Math.max(20, window.innerWidth - BASE_FRAME_BOUNDS.width - 20),
        top: Math.max(20, window.innerHeight - BASE_FRAME_BOUNDS.height - 76)
    };
}

function isOverlayDockSide(value: unknown): value is OverlayDockSide {
    return value === 'bottom' || value === 'floating' || value === 'right';
}

function getClientRoute(clientUrl: string): string {
    try {
        const url = new URL(clientUrl, window.location.href);

        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return clientUrl;
    }
}

function getPanelStyle(preferences: OverlayPreferences) {
    const bounds = preferences.bounds;

    if (preferences.dock === 'bottom') {
        return {
            bottom: 0,
            height: preferences.minimized ? 40 : bounds.height,
            left: 0,
            right: 0,
            top: 'auto',
            width: '100vw'
        };
    }

    if (preferences.dock === 'right') {
        return {
            bottom: 0,
            height: '100vh',
            left: 'auto',
            right: 0,
            top: 0,
            width: preferences.minimized ? 280 : bounds.width
        };
    }

    return {
        height: preferences.minimized ? 40 : bounds.height,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width
    };
}

function startPanelDrag(
    event: ReactPointerEvent<HTMLElement>,
    preferences: OverlayPreferences,
    setBounds: (bounds: OverlayFrameBounds) => void
): void {
    if (preferences.dock !== 'floating' || preferences.minimized) {
        return;
    }

    const target = event.target;

    if (
        target instanceof HTMLElement &&
        target.closest('.react-devtools-overlay__toolbar-actions')
    ) {
        return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startBounds = preferences.bounds;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
        setBounds({
            ...startBounds,
            left: startBounds.left + moveEvent.clientX - startX,
            top: startBounds.top + moveEvent.clientY - startY
        });
    }

    function handlePointerUp() {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
}

function startPanelResize(
    event: ReactPointerEvent<HTMLElement>,
    preferences: OverlayPreferences,
    setBounds: (bounds: OverlayFrameBounds) => void
): void {
    if (preferences.dock !== 'floating') {
        return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startBounds = preferences.bounds;

    event.currentTarget.setPointerCapture?.(event.pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
        setBounds({
            ...startBounds,
            height: startBounds.height + moveEvent.clientY - startY,
            width: startBounds.width + moveEvent.clientX - startX
        });
    }

    function handlePointerUp() {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split('+');
    const key = parts.at(-1);
    const wantsAlt = parts.includes('alt') || parts.includes('option');
    const wantsCtrl = parts.includes('ctrl') || parts.includes('control');
    const wantsMeta = parts.includes('meta') || parts.includes('cmd');
    const wantsShift = parts.includes('shift');

    return (
        Boolean(key) &&
        event.key.toLowerCase() === key &&
        event.altKey === wantsAlt &&
        event.ctrlKey === wantsCtrl &&
        event.metaKey === wantsMeta &&
        event.shiftKey === wantsShift
    );
}
