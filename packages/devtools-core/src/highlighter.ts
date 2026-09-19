import { ReactFiberTag } from './fiber.js';
import type { ReactFiber } from './fiber.js';

export interface BoundingRect {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
    x: number;
    y: number;
}

export interface HighlightElementOptions {
    className?: string;
    document?: HighlighterDocument;
}

interface HighlighterDocument {
    body?: null | HighlighterElement;
    createElement(tagName: string): HighlighterElement;
    defaultView?: null | {
        scrollX?: number;
        scrollY?: number;
    };
}

interface HighlighterElement {
    dataset?: Record<string, string>;
    getBoundingClientRect?: () => BoundingRectLike;
    nodeType?: number;
    ownerDocument?: null | HighlighterDocument;
    parentNode?: null | HighlighterElement;
    remove?: () => void;
    setAttribute?: (name: string, value: string) => void;
    style?: Partial<Record<string, string>>;
    tagName?: string;
}

interface BoundingRectLike {
    bottom?: number;
    height?: number;
    left?: number;
    right?: number;
    top?: number;
    width?: number;
    x?: number;
    y?: number;
}

let activeHighlightElement: null | HighlighterElement = null;

export function getBoundingRect(fiber: ReactFiber): BoundingRect | null {
    const hostNode = findNearestHostNode(fiber);

    if (!hostNode?.getBoundingClientRect) {
        return null;
    }

    return normalizeRect(hostNode.getBoundingClientRect());
}

export function highlightElement(
    fiber: ReactFiber,
    options: HighlightElementOptions = {}
): BoundingRect | null {
    const rect = getBoundingRect(fiber);

    if (!rect) {
        unhighlightElement();
        return null;
    }

    unhighlightElement();

    const document = options.document ?? findHighlighterDocument(fiber);
    const body = document?.body;

    if (!document || !body) {
        return rect;
    }

    const overlay = document.createElement('div');
    const scrollX = document.defaultView?.scrollX ?? 0;
    const scrollY = document.defaultView?.scrollY ?? 0;

    overlay.setAttribute?.('aria-hidden', 'true');
    overlay.setAttribute?.('data-react-devtools-highlighter', 'true');

    if (options.className) {
        overlay.setAttribute?.('class', options.className);
    }

    if (overlay.dataset) {
        overlay.dataset.reactDevtoolsHighlighter = 'true';
    }

    applyStyle(overlay, {
        backgroundColor: 'rgba(79, 70, 229, 0.12)',
        border: '2px solid rgba(79, 70, 229, 0.92)',
        boxSizing: 'border-box',
        height: `${rect.height}px`,
        left: `${rect.left + scrollX}px`,
        pointerEvents: 'none',
        position: 'absolute',
        top: `${rect.top + scrollY}px`,
        width: `${rect.width}px`,
        zIndex: '2147483647'
    });

    appendChild(body, overlay);
    activeHighlightElement = overlay;

    return rect;
}

export function unhighlightElement(): void {
    activeHighlightElement?.remove?.();
    activeHighlightElement = null;
}

function findNearestHostNode(fiber: ReactFiber): null | HighlighterElement {
    const visited = new Set<ReactFiber>();
    const candidates: ReactFiber[] = [fiber];

    while (candidates.length > 0) {
        const current = candidates.shift();

        if (!current || visited.has(current)) {
            continue;
        }

        visited.add(current);

        if (isHostFiber(current)) {
            const node = getHostElement(current.stateNode);

            if (node) {
                return node;
            }
        }

        if (current.child) {
            candidates.unshift(current.child);
        }

        for (
            let sibling = current.sibling;
            sibling;
            sibling = sibling.sibling
        ) {
            candidates.push(sibling);
        }
    }

    return null;
}

function findHighlighterDocument(
    fiber: ReactFiber
): null | HighlighterDocument {
    return findNearestHostNode(fiber)?.ownerDocument ?? null;
}

function getHostElement(value: unknown): null | HighlighterElement {
    if (!isElementLike(value)) {
        return null;
    }

    if (value.nodeType === 3) {
        return isElementLike(value.parentNode) ? value.parentNode : null;
    }

    return value;
}

function normalizeRect(rect: BoundingRectLike): BoundingRect {
    const left = rect.left ?? rect.x ?? 0;
    const top = rect.top ?? rect.y ?? 0;
    const width = rect.width ?? Math.max((rect.right ?? left) - left, 0);
    const height = rect.height ?? Math.max((rect.bottom ?? top) - top, 0);

    return {
        bottom: rect.bottom ?? top + height,
        height,
        left,
        right: rect.right ?? left + width,
        top,
        width,
        x: rect.x ?? left,
        y: rect.y ?? top
    };
}

function appendChild(
    parent: HighlighterElement,
    child: HighlighterElement
): void {
    const append = (
        parent as HighlighterElement & {
            appendChild?: (child: HighlighterElement) => unknown;
        }
    ).appendChild;

    append?.call(parent, child);
}

function applyStyle(
    element: HighlighterElement,
    style: Record<string, string>
): void {
    if (!element.style) {
        element.style = {};
    }

    Object.assign(element.style, style);
}

function isElementLike(value: unknown): value is HighlighterElement {
    return typeof value === 'object' && value !== null && 'nodeType' in value;
}

function isHostFiber(fiber: ReactFiber): boolean {
    return (
        fiber.tag === ReactFiberTag.HostComponent ||
        fiber.tag === ReactFiberTag.HostText
    );
}
