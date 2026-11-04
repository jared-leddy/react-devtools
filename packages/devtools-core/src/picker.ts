import { ReactFiberTag, type ReactFiber } from './fiber.js';
import type { FiberRootRegistry } from './fiber/record.js';
import { highlightElement, unhighlightElement } from './highlighter.js';
import type { InspectTargetRecord } from './types.js';

export interface PickerNode {
    closest?: (selector: string) => unknown;
    parentNode: PickerNode | null;
    scrollIntoView?: (options: { block: 'center'; inline: 'nearest' }) => void;
}
interface PickerEvent {
    key?: string;
    composedPath(): PickerNode[];
    preventDefault(): void;
    stopImmediatePropagation(): void;
}
type PickerListener = (event: PickerEvent) => void;
interface PickerElement {
    dataset: Record<string, string>;
    style: Record<string, string>;
    textContent: string | null;
    setAttribute(name: string, value: string): void;
    remove(): void;
}
export interface PickerDocument {
    body?: { appendChild(node: PickerElement): void } | null;
    createElement(name: string): PickerElement;
    defaultView?: {
        getComputedStyle(node: PickerElement): { position: string };
    } | null;
    addEventListener(
        type: string,
        handler: PickerListener,
        capture: boolean
    ): void;
    removeEventListener(
        type: string,
        handler: PickerListener,
        capture: boolean
    ): void;
    querySelectorAll(selector: string): Iterable<{
        hasAttribute?: (name: string) => boolean;
        contentDocument: PickerDocument | null;
        addEventListener(type: string, handler: () => void): void;
        removeEventListener(type: string, handler: () => void): void;
    }>;
}

/** Resolve against the current registry, never DOM annotations or stale Fiber IDs. */
export function resolveInspectTarget(
    registry: FiberRootRegistry,
    element: PickerNode
) {
    for (let node: PickerNode | null = element; node; node = node.parentNode) {
        for (const record of registry.records) {
            const ids = new Map<ReactFiber, string>();
            for (const [id, fiber] of record.instanceMap) {
                ids.set(fiber, id);
                const alternate = fiber.alternate;
                if (
                    alternate?.alternate === fiber &&
                    alternate.key === fiber.key &&
                    (alternate.elementType ?? alternate.type) ===
                        (fiber.elementType ?? fiber.type)
                )
                    ids.set(alternate, id);
            }
            const visited = new Set<ReactFiber>();
            const pending = [record.root.current];
            while (pending.length) {
                const fiber = pending.pop()!;
                if (visited.has(fiber)) continue;
                visited.add(fiber);
                if (fiber.stateNode === node) {
                    let fallback:
                        | { fiber: ReactFiber; target: InspectTargetRecord }
                        | undefined;
                    const ancestors = new Set<ReactFiber>();
                    for (
                        let owner: ReactFiber | null | undefined = fiber;
                        owner && !ancestors.has(owner);
                        owner = owner.return
                    ) {
                        ancestors.add(owner);
                        const id = ids.get(owner);
                        if (
                            id &&
                            owner.tag === ReactFiberTag.HostComponent &&
                            !fallback
                        )
                            fallback = {
                                fiber: record.instanceMap.get(id)!,
                                target: { componentId: id, rootId: record.id }
                            };
                        if (
                            id &&
                            owner.tag !== ReactFiberTag.HostComponent &&
                            owner.tag !== ReactFiberTag.HostPortal
                        )
                            return {
                                fiber: record.instanceMap.get(id)!,
                                target: {
                                    componentId: id,
                                    rootId: record.id
                                } satisfies InspectTargetRecord
                            };
                    }
                    if (fallback) return fallback;
                }
                if (fiber.child) pending.push(fiber.child);
                if (fiber.sibling) pending.push(fiber.sibling);
            }
        }
    }
    return undefined;
}

export function createPagePicker(options: {
    document?: PickerDocument;
    owner?: object;
    registry: FiberRootRegistry;
    refresh(): void;
    select(target: InspectTargetRecord): void;
    hover(target: InspectTargetRecord | null): void;
    cancel(): void;
}) {
    const cleanup: Array<() => void> = [];
    const documents = new Set<PickerDocument>();
    let hint: PickerElement | undefined;
    let hoveredId: string | undefined;
    const stop = () => {
        cleanup.splice(0).forEach((remove) => remove());
        documents.clear();
        hoveredId = undefined;
        hint?.remove();
        hint = undefined;
        unhighlightElement(options.owner);
    };
    const attach = (document: PickerDocument) => {
        if (documents.has(document)) return;
        documents.add(document);
        const listen = (type: string, handler: PickerListener) => {
            document.addEventListener(type, handler, true);
            cleanup.push(() =>
                document.removeEventListener(type, handler, true)
            );
        };
        listen('pointermove', (event) => {
            options.refresh();
            const node = event.composedPath()[0] as PickerNode;
            if (node.closest?.('[data-react-devtools-overlay]')) return;
            const match = resolveInspectTarget(options.registry, node);
            if (match) {
                highlightElement(match.fiber, { owner: options.owner });
                if (hoveredId !== match.target.componentId)
                    options.hover(match.target);
                hoveredId = match.target.componentId ?? undefined;
            } else {
                unhighlightElement(options.owner);
                if (hoveredId) options.hover(null);
                hoveredId = undefined;
            }
            if (hint)
                hint.textContent = match
                    ? `${match.fiber.type && typeof match.fiber.type === 'function' ? match.fiber.type.name : 'Component'} — click to select · Escape to cancel`
                    : 'No component here. Cross-origin frames cannot be inspected. Escape to cancel.';
        });
        listen('click', (event) => {
            const node = event.composedPath()[0] as PickerNode;
            if (node.closest?.('[data-react-devtools-overlay]')) return;
            options.refresh();
            const match = resolveInspectTarget(options.registry, node);
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!match) return;
            stop();
            options.select({
                ...match.target,
                selectionId: globalThis.crypto.randomUUID()
            });
        });
        // Prevent application pointer handlers from changing the inspected target before click.
        for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup'])
            listen(type, (event) => {
                if (
                    event
                        .composedPath()[0]
                        ?.closest?.('[data-react-devtools-overlay]')
                )
                    return;
                event.preventDefault();
                event.stopImmediatePropagation();
            });
        listen('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            stop();
            options.cancel();
        });
        for (const frame of document.querySelectorAll('iframe')) {
            if (frame.hasAttribute?.('data-react-devtools-iframe')) continue;
            const attachFrame = () => {
                try {
                    if (frame.contentDocument) attach(frame.contentDocument);
                } catch {
                    /* Cross-origin frames stay isolated. */
                }
            };
            attachFrame();
            frame.addEventListener('load', attachFrame);
            cleanup.push(() => frame.removeEventListener('load', attachFrame));
        }
    };
    return {
        stop,
        start() {
            stop();
            const document = options.document;
            if (!document?.body)
                throw new Error('Picker unavailable: document inaccessible');
            try {
                hint = document.createElement('div');
                hint.dataset.reactDevtoolsPicker = 'true';
                hint.setAttribute('role', 'status');
                hint.textContent = 'Click a component · Escape to cancel';
                Object.assign(hint.style, {
                    position: 'fixed',
                    bottom: '12px',
                    left: '12px',
                    padding: '8px 12px',
                    background: '#16241b',
                    color: '#e6f4ea',
                    border: '1px solid #3fb950',
                    font: '12px monospace',
                    zIndex: '2147483647',
                    pointerEvents: 'none'
                });
                document.body.appendChild(hint);
                // Inline styles can be blocked by the inspected page CSP. Fail visibly in the panel.
                if (
                    document.defaultView?.getComputedStyle(hint).position !==
                    'fixed'
                )
                    throw new Error('Picker blocked by page style policy');
                attach(document);
            } catch (error) {
                stop();
                throw error;
            }
        }
    };
}
