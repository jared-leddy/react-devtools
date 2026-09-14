import { getTargetObject, isFunction, isRecord } from '@devtools/shared';

export const REACT_DEVTOOLS_GLOBAL_HOOK_KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';

export type ReactDevToolsRendererID = number;
export type ReactDevToolsRenderer = Record<PropertyKey, unknown>;
export type ReactDevToolsFiberRoot = Record<PropertyKey, unknown>;
export type ReactDevToolsFiber = Record<PropertyKey, unknown>;
export type DevToolsHookInstallMode = 'installed' | 'wrapped' | 'disabled';

export interface ReactDevToolsHookTarget {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
}

export interface ReactDevToolsHookEventMap {
    renderer: {
        id: ReactDevToolsRendererID;
        renderer: ReactDevToolsRenderer;
    };
    'renderer-attached': {
        id: ReactDevToolsRendererID;
        rendererInterface: ReactDevToolsRendererInterface;
    };
    'commit-fiber-root': {
        didError?: boolean;
        priorityLevel?: unknown;
        rendererID: ReactDevToolsRendererID;
        root: ReactDevToolsFiberRoot;
    };
    'post-commit-fiber-root': {
        rendererID: ReactDevToolsRendererID;
        root: ReactDevToolsFiberRoot;
    };
    'commit-fiber-unmount': {
        fiber: ReactDevToolsFiber;
        rendererID: ReactDevToolsRendererID;
    };
}

export type ReactDevToolsHookEventName = keyof ReactDevToolsHookEventMap;
export type ReactDevToolsHookListener<
    TEventName extends ReactDevToolsHookEventName
> = (payload: ReactDevToolsHookEventMap[TEventName]) => void;

export interface ReactDevToolsRendererInterface {
    renderer: ReactDevToolsRenderer;
}

export interface ReactDevToolsGlobalHook {
    checkDCE?: (fn: (...args: unknown[]) => unknown) => void;
    getFiberRoots: (
        rendererID: ReactDevToolsRendererID
    ) => Set<ReactDevToolsFiberRoot>;
    inject: (renderer: ReactDevToolsRenderer) => ReactDevToolsRendererID;
    off: <TEventName extends ReactDevToolsHookEventName>(
        event: TEventName,
        listener: ReactDevToolsHookListener<TEventName>
    ) => void;
    on: <TEventName extends ReactDevToolsHookEventName>(
        event: TEventName,
        listener: ReactDevToolsHookListener<TEventName>
    ) => void;
    once: <TEventName extends ReactDevToolsHookEventName>(
        event: TEventName,
        listener: ReactDevToolsHookListener<TEventName>
    ) => void;
    sub: <TEventName extends ReactDevToolsHookEventName>(
        event: TEventName,
        listener: ReactDevToolsHookListener<TEventName>
    ) => () => void;
    emit: <TEventName extends ReactDevToolsHookEventName>(
        event: TEventName,
        payload: ReactDevToolsHookEventMap[TEventName]
    ) => void;
    onCommitFiberRoot: (
        rendererID: ReactDevToolsRendererID,
        root: ReactDevToolsFiberRoot,
        priorityLevel?: unknown,
        didError?: boolean
    ) => void;
    onCommitFiberUnmount: (
        rendererID: ReactDevToolsRendererID,
        fiber: ReactDevToolsFiber
    ) => void;
    onPostCommitFiberRoot: (
        rendererID: ReactDevToolsRendererID,
        root: ReactDevToolsFiberRoot
    ) => void;
    rendererInterfaces: Map<
        ReactDevToolsRendererID,
        ReactDevToolsRendererInterface
    >;
    renderers: Map<ReactDevToolsRendererID, ReactDevToolsRenderer>;
    supportsFiber: true;
}

export interface CreateDevToolsHookOptions {
    logger?: Pick<Console, 'error' | 'warn'>;
    target?: ReactDevToolsHookTarget;
}

export interface DevToolsHookInstallation {
    hook: ReactDevToolsGlobalHook | null;
    mode: DevToolsHookInstallMode;
    reason?: string;
}

type ListenerRegistry = {
    [TEventName in ReactDevToolsHookEventName]?: Array<
        ReactDevToolsHookListener<TEventName>
    >;
};

const defaultLogger: Pick<Console, 'error' | 'warn'> = console;

export function createDevToolsHook(
    options: CreateDevToolsHookOptions = {}
): DevToolsHookInstallation {
    const target = (options.target ??
        getTargetObject()) as ReactDevToolsHookTarget;
    const logger = options.logger ?? defaultLogger;
    const existingHook = target[REACT_DEVTOOLS_GLOBAL_HOOK_KEY];

    if (existingHook === undefined) {
        const hook = createStandaloneReactDevToolsHook(logger);
        defineGlobalHook(target, hook);

        return { hook, mode: 'installed' };
    }

    if (isCompatibleReactHook(existingHook)) {
        return {
            hook: wrapExistingReactDevToolsHook(existingHook, logger),
            mode: 'wrapped'
        };
    }

    const reason =
        'Existing __REACT_DEVTOOLS_GLOBAL_HOOK__ is not compatible with React Fiber devtools.';
    logger.warn(`[react-devtools] ${reason}`);

    return { hook: null, mode: 'disabled', reason };
}

export function isCompatibleReactHook(
    value: unknown
): value is ReactDevToolsGlobalHook {
    return (
        isRecord(value) &&
        value.supportsFiber === true &&
        isFunction(value.inject) &&
        isFunction(value.onCommitFiberRoot) &&
        isFunction(value.onCommitFiberUnmount)
    );
}

function createStandaloneReactDevToolsHook(
    logger: Pick<Console, 'error' | 'warn'>
): ReactDevToolsGlobalHook {
    const listeners: ListenerRegistry = {};
    const fiberRoots = new Map<
        ReactDevToolsRendererID,
        Set<ReactDevToolsFiberRoot>
    >();
    let nextRendererID = 0;

    const hook: ReactDevToolsGlobalHook = {
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
            safeEmit(logger, listeners, 'renderer', {
                id: rendererID,
                renderer
            });
            safeEmit(logger, listeners, 'renderer-attached', {
                id: rendererID,
                rendererInterface: hook.rendererInterfaces.get(rendererID)!
            });

            return rendererID;
        },
        off(event, listener) {
            removeListener(listeners, event, listener);
        },
        on(event, listener) {
            addListener(listeners, event, listener);
        },
        once(event, listener) {
            const wrappedListener = (
                payload: ReactDevToolsHookEventMap[typeof event]
            ) => {
                removeListener(listeners, event, wrappedListener);
                listener(payload);
            };

            addListener(listeners, event, wrappedListener);
        },
        sub(event, listener) {
            addListener(listeners, event, listener);

            return () => removeListener(listeners, event, listener);
        },
        emit(event, payload) {
            safeEmit(logger, listeners, event, payload);
        },
        onCommitFiberRoot(rendererID, root, priorityLevel, didError) {
            hook.getFiberRoots(rendererID).add(root);
            safeEmit(logger, listeners, 'commit-fiber-root', {
                didError,
                priorityLevel,
                rendererID,
                root
            });
        },
        onCommitFiberUnmount(rendererID, fiber) {
            safeEmit(logger, listeners, 'commit-fiber-unmount', {
                fiber,
                rendererID
            });
        },
        onPostCommitFiberRoot(rendererID, root) {
            safeEmit(logger, listeners, 'post-commit-fiber-root', {
                rendererID,
                root
            });
        },
        rendererInterfaces: new Map(),
        renderers: new Map(),
        supportsFiber: true
    };

    return hook;
}

function wrapExistingReactDevToolsHook(
    hook: ReactDevToolsGlobalHook,
    logger: Pick<Console, 'error' | 'warn'>
): ReactDevToolsGlobalHook {
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

        safeHookCall(logger, () => {
            hook.emit('renderer', { id: rendererID, renderer });
            hook.emit('renderer-attached', {
                id: rendererID,
                rendererInterface
            });
        });

        return rendererID;
    };
    hook.onCommitFiberRoot = (rendererID, root, priorityLevel, didError) => {
        const result = originalOnCommitFiberRoot(
            rendererID,
            root,
            priorityLevel,
            didError
        );
        safeHookCall(logger, () => {
            hook.emit('commit-fiber-root', {
                didError,
                priorityLevel,
                rendererID,
                root
            });
        });

        return result;
    };
    hook.onCommitFiberUnmount = (rendererID, fiber) => {
        const result = originalOnCommitFiberUnmount(rendererID, fiber);
        safeHookCall(logger, () => {
            hook.emit('commit-fiber-unmount', { fiber, rendererID });
        });

        return result;
    };
    hook.onPostCommitFiberRoot = (rendererID, root) => {
        const result = originalOnPostCommitFiberRoot?.(rendererID, root);
        safeHookCall(logger, () => {
            hook.emit('post-commit-fiber-root', { rendererID, root });
        });

        return result;
    };

    return hook;
}

function defineGlobalHook(
    target: ReactDevToolsHookTarget,
    hook: ReactDevToolsGlobalHook
): void {
    Object.defineProperty(target, REACT_DEVTOOLS_GLOBAL_HOOK_KEY, {
        configurable: true,
        enumerable: false,
        value: hook
    });
}

function addListener<TEventName extends ReactDevToolsHookEventName>(
    listeners: ListenerRegistry,
    event: TEventName,
    listener: ReactDevToolsHookListener<TEventName>
): void {
    listeners[event] ??= [];
    listeners[event].push(listener);
}

function removeListener<TEventName extends ReactDevToolsHookEventName>(
    listeners: ListenerRegistry,
    event: TEventName,
    listener: ReactDevToolsHookListener<TEventName>
): void {
    const eventListeners = listeners[event];

    if (!eventListeners) {
        return;
    }

    const index = eventListeners.indexOf(listener);

    if (index >= 0) {
        eventListeners.splice(index, 1);
    }
}

function safeEmit<TEventName extends ReactDevToolsHookEventName>(
    logger: Pick<Console, 'error' | 'warn'>,
    listeners: ListenerRegistry,
    event: TEventName,
    payload: ReactDevToolsHookEventMap[TEventName]
): void {
    const eventListeners = listeners[event]?.slice() ?? [];

    for (const listener of eventListeners) {
        safeHookCall(logger, () => listener(payload));
    }
}

function safeHookCall(
    logger: Pick<Console, 'error' | 'warn'>,
    callback: () => void
): void {
    try {
        callback();
    } catch (error) {
        logger.error(
            '[react-devtools] Error while notifying hook listener',
            error
        );
    }
}
