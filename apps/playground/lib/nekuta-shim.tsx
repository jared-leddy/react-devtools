'use client';

import {
    Component,
    createContext,
    createElement,
    useContext,
    useSyncExternalStore,
    type ComponentType,
    type ReactNode
} from 'react';
import {
    createNekuta,
    getDefaultNekuta,
    mapStores,
    type MappedStores,
    type StoreAccessor,
    type StoreContainer,
    type StoreMap,
    type StoreRuntime
} from './nekuta-store-shim';

export { createNekuta };
export type { MappedStores };

const NekutaContext = createContext(getDefaultNekuta());

export function NekutaStore({
    nekuta,
    children
}: {
    nekuta: StoreContainer;
    children: ReactNode;
}) {
    return (
        <NekutaContext.Provider value={nekuta}>
            {children}
        </NekutaContext.Provider>
    );
}

export function NekutaClientProvider({
    children
}: {
    state?: Record<string, unknown>;
    children: ReactNode;
}) {
    return (
        <NekutaContext.Provider value={getDefaultNekuta()}>
            {children}
        </NekutaContext.Provider>
    );
}

export function NekutaAppProvider({
    children
}: {
    pageProps?: Record<string, unknown>;
    children: ReactNode;
}) {
    return (
        <NekutaContext.Provider value={getDefaultNekuta()}>
            {children}
        </NekutaContext.Provider>
    );
}

export function useStore<TStore>(accessor: StoreAccessor<TStore>): TStore {
    const container = useContext(NekutaContext);
    const store = accessor(container) as TStore &
        StoreRuntime<Record<string, unknown>>;
    useSyncExternalStore(store.__subscribe, store.__snapshot, store.__snapshot);
    return store;
}

export function connectStore<TStores extends StoreMap>(
    stores: TStores,
    StoreComponent: typeof Component
): ComponentType;
export function connectStore<
    TStoreComponent extends typeof Component & { stores: StoreMap }
>(StoreComponent: TStoreComponent): ComponentType;
export function connectStore(
    first: StoreMap | (typeof Component & { stores?: StoreMap }),
    second?: typeof Component
): ComponentType {
    const stores = second
        ? (first as StoreMap)
        : (first as typeof Component & { stores: StoreMap }).stores;
    const StoreComponent = (second ?? first) as typeof Component;

    class StoreComponentWithMappedStores extends StoreComponent {
        declare props: { __stores: Record<string, unknown> };
        declare store: Record<string, unknown>;

        override render() {
            this.store = this.props.__stores;
            return super.render();
        }
    }

    return function ConnectedStoreComponent(props) {
        const mappedStores = useMappedStores(stores);
        const ComponentWithStores =
            StoreComponentWithMappedStores as unknown as ComponentType<
                Record<string, unknown> & { __stores: Record<string, unknown> }
            >;
        return createElement(ComponentWithStores, {
            ...props,
            __stores: mappedStores
        });
    };
}

function useMappedStores<TStores extends StoreMap>(
    stores: TStores
): MappedStores<TStores> {
    const container = useContext(NekutaContext);
    const mappedStores = mapStores(stores, container);

    useSyncExternalStore(
        (listener) => {
            const unsubscribes = Object.values(mappedStores).map((store) =>
                (store as StoreRuntime<Record<string, unknown>>).__subscribe(
                    listener
                )
            );
            return () => {
                unsubscribes.forEach((unsubscribe) => unsubscribe());
            };
        },
        () =>
            Object.values(mappedStores)
                .map((store) =>
                    (
                        store as StoreRuntime<Record<string, unknown>>
                    ).__snapshot()
                )
                .join('|'),
        () => ''
    );

    return mappedStores;
}
