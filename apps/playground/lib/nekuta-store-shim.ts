type Listener = () => void;
export type ActionSubscriber = (context: {
    name: string | symbol;
    after: (callback: () => void) => void;
}) => void;

export interface StoreContainer {
    stores: Map<string, unknown>;
}

export type StoreAccessor<TStore> = (container?: StoreContainer) => TStore;

export type StoreMap = Record<string, StoreAccessor<any>>;

export type MappedStores<TStores extends StoreMap> = {
    [Key in keyof TStores]: ReturnType<TStores[Key]>;
};

type GetterMap<TState extends Record<string, unknown>> = Record<
    string,
    (state: TState) => unknown
>;

type ActionMap<TState extends Record<string, unknown>> = Record<
    string,
    (this: TState & StoreRuntime<TState>, ...args: any[]) => unknown
>;

type GetterResults<TGetters extends GetterMap<any>> = {
    [Key in keyof TGetters]: ReturnType<TGetters[Key]>;
};

type ActionMethods<TActions extends ActionMap<any>> = {
    [Key in keyof TActions]: TActions[Key] extends (
        this: any,
        ...args: infer Args
    ) => infer Result
        ? (...args: Args) => Result
        : never;
};

type DefinedStore<
    TState extends Record<string, unknown>,
    TGetters extends GetterMap<TState>,
    TActions extends ActionMap<TState>
> = TState &
    GetterResults<TGetters> &
    ActionMethods<TActions> &
    StoreRuntime<TState>;

interface StoreOptions<
    TState extends Record<string, unknown>,
    TGetters extends GetterMap<TState>,
    TActions extends ActionMap<TState>
> {
    id: string;
    state: () => TState;
    getters?: TGetters;
    actions?: TActions;
}

export interface StoreRuntime<TState extends Record<string, unknown>> {
    $patch: (mutator: (state: TState) => void) => void;
    $subscribe: (listener: (mutation: { type: string }) => void) => () => void;
    $onAction: (listener: ActionSubscriber) => () => void;
    __subscribe: (listener: Listener) => () => void;
    __snapshot: () => number;
}

const defaultContainer: StoreContainer = {
    stores: new Map()
};

export function createNekuta(): StoreContainer {
    return {
        stores: new Map()
    };
}

export function getDefaultNekuta(): StoreContainer {
    return defaultContainer;
}

export function getActiveNekuta(): StoreContainer {
    return defaultContainer;
}

export function serializeNekutaState(
    container: StoreContainer
): Record<string, unknown> {
    return Object.fromEntries(
        Array.from(container.stores, ([id, store]) => [
            id,
            JSON.parse(JSON.stringify(store))
        ])
    );
}

export function getServerNekuta(): StoreContainer {
    return createNekuta();
}

export function withNekutaSSR<TProps extends Record<string, unknown>>(
    getServerSideProps: () => Promise<{ props: TProps }> | { props: TProps }
) {
    return getServerSideProps;
}

export function defineStore<
    TState extends Record<string, unknown>,
    TGetters extends GetterMap<TState> = Record<never, never>,
    TActions extends ActionMap<TState> = Record<never, never>
>(
    options: StoreOptions<TState, TGetters, TActions>
): StoreAccessor<DefinedStore<TState, TGetters, TActions>> {
    return function useDefinedStore(container = defaultContainer) {
        if (!container.stores.has(options.id)) {
            container.stores.set(options.id, createStore(options));
        }

        return container.stores.get(options.id) as DefinedStore<
            TState,
            TGetters,
            TActions
        >;
    };
}

export function mapStores<TStores extends StoreMap>(
    stores: TStores,
    container = defaultContainer
): MappedStores<TStores> {
    return Object.fromEntries(
        Object.entries(stores).map(([name, accessor]) => [
            name,
            accessor(container)
        ])
    ) as MappedStores<TStores>;
}

function createStore<
    TState extends Record<string, unknown>,
    TGetters extends GetterMap<TState>,
    TActions extends ActionMap<TState>
>(
    options: StoreOptions<TState, TGetters, TActions>
): DefinedStore<TState, TGetters, TActions> {
    let version = 0;
    const stateListeners = new Set<(mutation: { type: string }) => void>();
    const actionListeners = new Set<ActionSubscriber>();
    const renderListeners = new Set<Listener>();
    const store = options.state() as DefinedStore<TState, TGetters, TActions>;

    function notify(type: string) {
        version += 1;
        stateListeners.forEach((listener) => listener({ type }));
        renderListeners.forEach((listener) => listener());
    }

    Object.defineProperties(store, {
        $patch: {
            value(mutator: (state: TState) => void) {
                mutator(store);
                notify('patch');
            }
        },
        $subscribe: {
            value(listener: (mutation: { type: string }) => void) {
                stateListeners.add(listener);
                return () => {
                    stateListeners.delete(listener);
                };
            }
        },
        $onAction: {
            value(listener: ActionSubscriber) {
                actionListeners.add(listener);
                return () => {
                    actionListeners.delete(listener);
                };
            }
        },
        __subscribe: {
            value(listener: Listener) {
                renderListeners.add(listener);
                return () => {
                    renderListeners.delete(listener);
                };
            }
        },
        __snapshot: {
            value() {
                return version;
            }
        }
    });

    for (const [name, getter] of Object.entries(options.getters ?? {})) {
        Object.defineProperty(store, name, {
            enumerable: true,
            get: () => getter(store)
        });
    }

    for (const [name, action] of Object.entries(options.actions ?? {})) {
        Object.defineProperty(store, name, {
            enumerable: true,
            value: (...args: unknown[]) => {
                const afterCallbacks: Listener[] = [];
                actionListeners.forEach((listener) =>
                    listener({
                        name,
                        after: (callback) => afterCallbacks.push(callback)
                    })
                );
                const result = action.apply(store, args as never[]);
                notify('action');
                afterCallbacks.forEach((callback) => callback());
                return result;
            }
        });
    }

    return store;
}
