import * as React from 'react';

interface MockNekuta {
    _s: Map<string, unknown>;
    listeners: Set<() => void>;
}

interface MockStoreDefinition {
    actions?: Record<string, (...args: never[]) => unknown>;
    getters?: Record<string, (state: Record<string, unknown>) => unknown>;
    id: string;
    state?: () => Record<string, unknown>;
}

const NekutaContext = React.createContext<MockNekuta | null>(null);

function createStore(definition: MockStoreDefinition, nekuta: MockNekuta) {
    const state = definition.state?.() ?? {};
    const store: Record<string, unknown> = { ...state };
    const notify = () => {
        nekuta.listeners.forEach((listener) => {
            listener();
        });
    };

    for (const [key, getter] of Object.entries(definition.getters ?? {})) {
        Object.defineProperty(store, key, {
            enumerable: true,
            get: () => getter(store)
        });
    }

    for (const [key, action] of Object.entries(definition.actions ?? {})) {
        store[key] = (...args: never[]) => {
            const result = action.apply(store, args);
            notify();

            return result;
        };
    }

    store.$subscribe = (listener: () => void) => {
        nekuta.listeners.add(listener);

        return () => {
            nekuta.listeners.delete(listener);
        };
    };

    nekuta._s.set(definition.id, store);

    return store;
}

export function createNekuta(): MockNekuta {
    return {
        _s: new Map(),
        listeners: new Set()
    };
}

export function defineStore(definition: MockStoreDefinition) {
    const useDefinition = (nekuta: MockNekuta) => {
        if (!nekuta._s.has(definition.id)) {
            createStore(definition, nekuta);
        }

        return nekuta._s.get(definition.id);
    };

    useDefinition.$id = definition.id;

    return useDefinition;
}

export const disposeNekuta = jest.fn();

export function NekutaStore({
    children,
    nekuta
}: {
    children: React.ReactNode;
    nekuta: MockNekuta;
}) {
    return (
        <NekutaContext.Provider value={nekuta}>
            {children}
        </NekutaContext.Provider>
    );
}

export function useStore(useDefinition: (nekuta: MockNekuta) => unknown) {
    const nekuta = React.useContext(NekutaContext);
    const [, rerender] = React.useState(0);

    if (!nekuta) {
        throw new Error('Missing mocked Nekuta provider');
    }

    React.useEffect(() => {
        const listener = () => {
            rerender((value) => value + 1);
        };

        nekuta.listeners.add(listener);

        return () => {
            nekuta.listeners.delete(listener);
        };
    }, [nekuta]);

    return useDefinition(nekuta);
}
