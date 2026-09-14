import {
    createDevToolsHook,
    DEVTOOLS_KIT_PACKAGE_NAME,
    isCompatibleReactHook,
    type ReactDevToolsGlobalHook,
    type ReactDevToolsHookEventMap
} from '../src/index.js';

describe('@devtools/kit', () => {
    it('imports the package entry point without throwing', () => {
        expect(DEVTOOLS_KIT_PACKAGE_NAME).toBe('@devtools/kit');
    });

    it('installs a standalone React DevTools global hook when no hook exists', () => {
        const target = {};
        const installation = createDevToolsHook({ target });

        expect(installation.mode).toBe('installed');
        expect(installation.hook).toBeDefined();
        expect(isCompatibleReactHook(installation.hook)).toBe(true);
        expect(Object.keys(target)).not.toContain(
            '__REACT_DEVTOOLS_GLOBAL_HOOK__'
        );
        expect(
            (
                target as {
                    __REACT_DEVTOOLS_GLOBAL_HOOK__: ReactDevToolsGlobalHook;
                }
            ).__REACT_DEVTOOLS_GLOBAL_HOOK__
        ).toBe(installation.hook);
    });

    it('can install onto the default target when no target is provided', () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
            globalThis,
            '__REACT_DEVTOOLS_GLOBAL_HOOK__'
        );

        delete (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
            .__REACT_DEVTOOLS_GLOBAL_HOOK__;

        try {
            const installation = createDevToolsHook();

            expect(installation.mode).toBe('installed');
            expect(
                (
                    globalThis as {
                        __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsGlobalHook;
                    }
                ).__REACT_DEVTOOLS_GLOBAL_HOOK__
            ).toBe(installation.hook);
        } finally {
            delete (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
                .__REACT_DEVTOOLS_GLOBAL_HOOK__;

            if (originalDescriptor) {
                Object.defineProperty(
                    globalThis,
                    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
                    originalDescriptor
                );
            }
        }
    });

    it('tracks renderer injection, roots, commits, post-commits, and unmounts', () => {
        const target = {};
        const { hook } = createDevToolsHook({ target });
        const events: string[] = [];
        const roots: ReactDevToolsHookEventMap['commit-fiber-root'][] = [];
        const postCommits: ReactDevToolsHookEventMap['post-commit-fiber-root'][] =
            [];
        const unmounts: ReactDevToolsHookEventMap['commit-fiber-unmount'][] =
            [];

        expect(hook).not.toBeNull();
        hook!.on('renderer', ({ id }) => events.push(`renderer:${id}`));
        hook!.on('renderer-attached', ({ id }) =>
            events.push(`renderer-attached:${id}`)
        );
        hook!.on('commit-fiber-root', (payload) => roots.push(payload));
        hook!.on('post-commit-fiber-root', (payload) =>
            postCommits.push(payload)
        );
        hook!.on('commit-fiber-unmount', (payload) => unmounts.push(payload));

        const renderer = {
            rendererPackageName: 'react-dom',
            version: '19.1.1'
        };
        const root = { current: { memoizedState: { element: 'App' } } };
        const fiber = { tag: 'FunctionComponent' };
        const rendererID = hook!.inject(renderer);

        hook!.onCommitFiberRoot(rendererID, root, 'normal-priority', false);
        hook!.onPostCommitFiberRoot(rendererID, root);
        hook!.onCommitFiberUnmount(rendererID, fiber);

        expect(rendererID).toBe(1);
        expect(hook!.renderers.get(rendererID)).toBe(renderer);
        expect(hook!.rendererInterfaces.get(rendererID)).toEqual({ renderer });
        expect(hook!.getFiberRoots(rendererID).has(root)).toBe(true);
        expect(events).toEqual(['renderer:1', 'renderer-attached:1']);
        expect(roots).toEqual([
            {
                didError: false,
                priorityLevel: 'normal-priority',
                rendererID,
                root
            }
        ]);
        expect(postCommits).toEqual([{ rendererID, root }]);
        expect(unmounts).toEqual([{ fiber, rendererID }]);
    });

    it('supports once, off, sub, and manual emit for internal subscriptions', () => {
        const { hook } = createDevToolsHook({ target: {} });
        const calls: Array<number | string> = [];
        const root = { current: {} };
        const listener = ({
            rendererID
        }: ReactDevToolsHookEventMap['commit-fiber-root']) => {
            calls.push(rendererID);
        };
        const onceListener = ({
            rendererID
        }: ReactDevToolsHookEventMap['commit-fiber-root']) => {
            calls.push(`once:${rendererID}`);
        };
        const unsubscribedListener = ({
            rendererID
        }: ReactDevToolsHookEventMap['commit-fiber-root']) => {
            calls.push(`sub:${rendererID}`);
        };

        hook!.on('commit-fiber-root', listener);
        hook!.once('commit-fiber-root', onceListener);
        const unsubscribe = hook!.sub(
            'commit-fiber-root',
            unsubscribedListener
        );
        unsubscribe();
        hook!.off('post-commit-fiber-root', () => undefined);

        hook!.emit('commit-fiber-root', { rendererID: 1, root });
        hook!.emit('commit-fiber-root', { rendererID: 2, root });
        hook!.off('commit-fiber-root', listener);
        hook!.off('commit-fiber-root', listener);
        hook!.emit('commit-fiber-root', { rendererID: 3, root });
        hook!.emit('post-commit-fiber-root', { rendererID: 4, root });

        expect(calls).toEqual([1, 'once:1', 2]);
    });

    it('preserves and wraps an existing compatible hook', () => {
        const existingHook = createMockHook();
        const target = {
            __REACT_DEVTOOLS_GLOBAL_HOOK__: existingHook
        };
        const rootEvents: ReactDevToolsHookEventMap['commit-fiber-root'][] = [];
        const unmountEvents: ReactDevToolsHookEventMap['commit-fiber-unmount'][] =
            [];
        const rendererEvents: ReactDevToolsHookEventMap['renderer'][] = [];

        existingHook.on('renderer', (payload) => rendererEvents.push(payload));
        existingHook.on('commit-fiber-root', (payload) =>
            rootEvents.push(payload)
        );
        existingHook.on('commit-fiber-unmount', (payload) =>
            unmountEvents.push(payload)
        );

        const installation = createDevToolsHook({ target });
        const renderer = { rendererPackageName: 'react-dom' };
        const root = { current: {} };
        const fiber = { tag: 'HostComponent' };
        const rendererID = installation.hook!.inject(renderer);

        installation.hook!.onCommitFiberRoot(rendererID, root, undefined, true);
        installation.hook!.onPostCommitFiberRoot(rendererID, root);
        installation.hook!.onCommitFiberUnmount(rendererID, fiber);

        expect(installation.mode).toBe('wrapped');
        expect(installation.hook).toBe(existingHook);
        expect(target.__REACT_DEVTOOLS_GLOBAL_HOOK__).toBe(existingHook);
        expect(rendererID).toBe(101);
        expect(existingHook.originalCalls).toEqual([
            'inject',
            'commit:101',
            'post-commit:101',
            'unmount:101'
        ]);
        expect(rendererEvents).toEqual([{ id: 101, renderer }]);
        expect(rootEvents).toEqual([
            { didError: true, priorityLevel: undefined, rendererID, root }
        ]);
        expect(unmountEvents).toEqual([{ fiber, rendererID }]);
    });

    it('wraps existing hooks that do not populate rendererInterfaces', () => {
        const existingHook = createMockHook({
            shouldTrackRendererInterface: false
        });
        const rendererAttachedEvents: ReactDevToolsHookEventMap['renderer-attached'][] =
            [];

        existingHook.on('renderer-attached', (payload) =>
            rendererAttachedEvents.push(payload)
        );

        const installation = createDevToolsHook({
            target: { __REACT_DEVTOOLS_GLOBAL_HOOK__: existingHook }
        });
        const renderer = { rendererPackageName: 'react-dom' };

        installation.hook!.inject(renderer);

        expect(rendererAttachedEvents).toEqual([
            { id: 101, rendererInterface: { renderer } }
        ]);
    });

    it('disables installation and warns when a conflicting hook exists', () => {
        const warn = jest.fn();
        const target = {
            __REACT_DEVTOOLS_GLOBAL_HOOK__: { supportsFiber: false }
        };
        const installation = createDevToolsHook({
            logger: { error: jest.fn(), warn },
            target
        });

        expect(installation.mode).toBe('disabled');
        expect(installation.hook).toBeNull();
        expect(installation.reason).toContain('not compatible');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(target.__REACT_DEVTOOLS_GLOBAL_HOOK__).toEqual({
            supportsFiber: false
        });
    });

    it('isolates listener failures from hook callers', () => {
        const error = jest.fn();
        const { hook } = createDevToolsHook({
            logger: { error, warn: jest.fn() },
            target: {}
        });
        const healthyListener = jest.fn();
        const root = { current: {} };

        hook!.on('commit-fiber-root', () => {
            throw new Error('listener failed');
        });
        hook!.on('commit-fiber-root', healthyListener);

        expect(() => hook!.onCommitFiberRoot(1, root)).not.toThrow();
        expect(healthyListener).toHaveBeenCalledWith({
            didError: undefined,
            priorityLevel: undefined,
            rendererID: 1,
            root
        });
        expect(error).toHaveBeenCalledTimes(1);
    });
});

function createMockHook(
    options: { shouldTrackRendererInterface?: boolean } = {}
): ReactDevToolsGlobalHook & {
    originalCalls: string[];
} {
    type MockListener = (payload: unknown) => void;

    const listeners = new Map<string, MockListener[]>();
    const originalCalls: string[] = [];
    const hook = {
        getFiberRoots: jest.fn(() => new Set()),
        inject(renderer: Record<PropertyKey, unknown>) {
            originalCalls.push('inject');
            hook.renderers.set(101, renderer);

            if (options.shouldTrackRendererInterface ?? true) {
                hook.rendererInterfaces.set(101, { renderer });
            }

            return 101;
        },
        off(event: string, listener: MockListener) {
            const eventListeners = listeners.get(event);
            const index = eventListeners?.indexOf(listener) ?? -1;

            if (eventListeners && index >= 0) {
                eventListeners.splice(index, 1);
            }
        },
        on(event: string, listener: MockListener) {
            listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        },
        once(event: string, listener: MockListener) {
            const wrappedListener = (payload: unknown) => {
                hook.off(event, wrappedListener);
                listener(payload);
            };

            hook.on(event, wrappedListener);
        },
        sub(event: string, listener: MockListener) {
            hook.on(event, listener);

            return () => hook.off(event, listener);
        },
        emit(event: string, payload: unknown) {
            for (const listener of listeners.get(event) ?? []) {
                listener(payload);
            }
        },
        onCommitFiberRoot(rendererID: number) {
            originalCalls.push(`commit:${rendererID}`);
        },
        onCommitFiberUnmount(rendererID: number) {
            originalCalls.push(`unmount:${rendererID}`);
        },
        onPostCommitFiberRoot(rendererID: number) {
            originalCalls.push(`post-commit:${rendererID}`);
        },
        originalCalls,
        rendererInterfaces: new Map(),
        renderers: new Map(),
        supportsFiber: true as const
    };

    return hook as ReactDevToolsGlobalHook & { originalCalls: string[] };
}
