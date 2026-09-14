type HookCallback = (payload: unknown) => void | Promise<void>;

interface TestHookable {
    callHook(name: string, payload: unknown): Promise<void>;
    hook(name: string, callback: HookCallback): () => void;
}

export function createHooks(): TestHookable {
    const listeners = new Map<string, HookCallback[]>();

    return {
        async callHook(name, payload) {
            for (const listener of listeners.get(name) ?? []) {
                await listener(payload);
            }
        },
        hook(name, callback) {
            listeners.set(name, [...(listeners.get(name) ?? []), callback]);

            return () => {
                const eventListeners = listeners.get(name);

                if (!eventListeners) {
                    return;
                }

                const index = eventListeners.indexOf(callback);

                if (index >= 0) {
                    eventListeners.splice(index, 1);
                }
            };
        }
    };
}
