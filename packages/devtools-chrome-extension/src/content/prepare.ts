type HookInstallMode = 'disabled' | 'installed' | 'wrapped';

interface HookInstallation {
    mode: HookInstallMode;
    reason?: string;
}

interface ReactDevToolsRendererInterface {
    renderer: Record<PropertyKey, unknown>;
}

interface ReactDevToolsGlobalHook {
    emit: (event: string, payload: unknown) => void;
    getFiberRoots: (rendererID: number) => Set<Record<PropertyKey, unknown>>;
    inject: (renderer: Record<PropertyKey, unknown>) => number;
    off: (event: string, listener: (payload: unknown) => void) => void;
    on: (event: string, listener: (payload: unknown) => void) => void;
    once: (event: string, listener: (payload: unknown) => void) => void;
    onCommitFiberRoot: (
        rendererID: number,
        root: Record<PropertyKey, unknown>,
        priorityLevel?: unknown,
        didError?: boolean
    ) => void;
    onCommitFiberUnmount: (
        rendererID: number,
        fiber: Record<PropertyKey, unknown>
    ) => void;
    onPostCommitFiberRoot: (
        rendererID: number,
        root: Record<PropertyKey, unknown>
    ) => void;
    rendererInterfaces: Map<number, ReactDevToolsRendererInterface>;
    renderers: Map<number, Record<PropertyKey, unknown>>;
    sub: (event: string, listener: (payload: unknown) => void) => () => void;
    supportsFiber: true;
}

interface ReactDevToolsHookWindow extends Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
}

const REACT_DEVTOOLS_GLOBAL_HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';

const installation = installReactDevToolsHook(window);

window.dispatchEvent(
    new CustomEvent('__react_devtools_prepare_ready__', {
        detail: {
            mode: installation.mode,
            reason: installation.reason,
            source: 'react-devtools-extension'
        }
    })
);

function installReactDevToolsHook(
    target: ReactDevToolsHookWindow
): HookInstallation {
    const existingHook = target[REACT_DEVTOOLS_GLOBAL_HOOK_KEY];

    if (existingHook === undefined) {
        Object.defineProperty(target, REACT_DEVTOOLS_GLOBAL_HOOK_KEY, {
            configurable: true,
            enumerable: false,
            value: createStandaloneHook()
        });

        return { mode: 'installed' };
    }

    if (isCompatibleReactHook(existingHook)) {
        wrapExistingHook(existingHook);

        return { mode: 'wrapped' };
    }

    return {
        mode: 'disabled',
        reason: 'Existing __REACT_DEVTOOLS_GLOBAL_HOOK__ is not compatible with React Fiber devtools.'
    };
}

function createStandaloneHook(): ReactDevToolsGlobalHook {
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    const fiberRoots = new Map<number, Set<Record<PropertyKey, unknown>>>();
    let nextRendererID = 0;

    const hook: ReactDevToolsGlobalHook = {
        emit(event, payload) {
            for (const listener of listeners.get(event) ?? []) {
                listener(payload);
            }
        },
        getFiberRoots(rendererID) {
            let roots = fiberRoots.get(rendererID);

            if (!roots) {
                roots = new Set();
                fiberRoots.set(rendererID, roots);
            }

            return roots;
        },
        inject(renderer) {
            const rendererID = ++nextRendererID;
            hook.renderers.set(rendererID, renderer);
            hook.rendererInterfaces.set(rendererID, { renderer });
            hook.emit('renderer', { id: rendererID, renderer });
            hook.emit('renderer-attached', {
                id: rendererID,
                rendererInterface: hook.rendererInterfaces.get(rendererID)
            });

            return rendererID;
        },
        off(event, listener) {
            listeners.get(event)?.delete(listener);
        },
        on(event, listener) {
            addListener(listeners, event, listener);
        },
        once(event, listener) {
            const wrappedListener = (payload: unknown) => {
                hook.off(event, wrappedListener);
                listener(payload);
            };

            hook.on(event, wrappedListener);
        },
        onCommitFiberRoot(rendererID, root, priorityLevel, didError) {
            hook.getFiberRoots(rendererID).add(root);
            hook.emit('commit-fiber-root', {
                didError,
                priorityLevel,
                rendererID,
                root
            });
        },
        onCommitFiberUnmount(rendererID, fiber) {
            hook.emit('commit-fiber-unmount', { fiber, rendererID });
        },
        onPostCommitFiberRoot(rendererID, root) {
            hook.emit('post-commit-fiber-root', { rendererID, root });
        },
        rendererInterfaces: new Map(),
        renderers: new Map(),
        sub(event, listener) {
            hook.on(event, listener);

            return () => hook.off(event, listener);
        },
        supportsFiber: true
    };

    return hook;
}

function wrapExistingHook(hook: ReactDevToolsGlobalHook) {
    const originalInject = hook.inject.bind(hook);
    const originalOnCommitFiberRoot = hook.onCommitFiberRoot.bind(hook);
    const originalOnCommitFiberUnmount = hook.onCommitFiberUnmount.bind(hook);
    const originalOnPostCommitFiberRoot =
        hook.onPostCommitFiberRoot?.bind(hook);

    hook.inject = (renderer) => {
        const rendererID = originalInject(renderer);
        const rendererInterface = hook.rendererInterfaces.get(rendererID) ?? {
            renderer
        };
        hook.emit('renderer', { id: rendererID, renderer });
        hook.emit('renderer-attached', { id: rendererID, rendererInterface });

        return rendererID;
    };

    hook.onCommitFiberRoot = (rendererID, root, priorityLevel, didError) => {
        originalOnCommitFiberRoot(rendererID, root, priorityLevel, didError);
        hook.emit('commit-fiber-root', {
            didError,
            priorityLevel,
            rendererID,
            root
        });
    };

    hook.onCommitFiberUnmount = (rendererID, fiber) => {
        originalOnCommitFiberUnmount(rendererID, fiber);
        hook.emit('commit-fiber-unmount', { fiber, rendererID });
    };

    hook.onPostCommitFiberRoot = (rendererID, root) => {
        originalOnPostCommitFiberRoot?.(rendererID, root);
        hook.emit('post-commit-fiber-root', { rendererID, root });
    };
}

function addListener(
    listeners: Map<string, Set<(payload: unknown) => void>>,
    event: string,
    listener: (payload: unknown) => void
) {
    let eventListeners = listeners.get(event);

    if (!eventListeners) {
        eventListeners = new Set();
        listeners.set(event, eventListeners);
    }

    eventListeners.add(listener);
}

function isCompatibleReactHook(
    value: unknown
): value is ReactDevToolsGlobalHook {
    return (
        isRecord(value) &&
        value.supportsFiber === true &&
        typeof value.inject === 'function' &&
        typeof value.onCommitFiberRoot === 'function' &&
        typeof value.onCommitFiberUnmount === 'function'
    );
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

export {};
