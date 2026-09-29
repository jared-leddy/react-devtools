import { useEffect, useMemo, useState } from 'react';
import { createNekuta, defineStore, NekutaStore, useStore } from '@nekuta/core';
import { registerNekutaDevTools } from '@devtools/nekuta-plugin';
import type { NekutaInstance, StoreGeneric } from '@nekuta/core';

type StoreAccessor<TStore extends StoreGeneric> = (
    nekuta?: NekutaInstance
) => TStore;

export const useViteCounterStore = defineStore({
    actions: {
        increment() {
            this.count += 1;
        },
        reset() {
            this.count = 0;
        }
    },
    getters: {
        doubled(state) {
            return state.count * 2;
        }
    },
    id: 'vite-counter',
    state: () => ({
        count: 0
    })
});

export const useViteTodoStore = defineStore({
    actions: {
        addTodo(title: string) {
            this.items.push({
                done: false,
                id: `todo-${this.nextId}`,
                title
            });
            this.nextId += 1;
        },
        toggleTodo(id: string) {
            const item = this.items.find((todo) => todo.id === id);

            if (item) {
                item.done = !item.done;
            }
        }
    },
    getters: {
        openCount(state) {
            return state.items.filter((item) => !item.done).length;
        }
    },
    id: 'vite-todos',
    state: () => ({
        items: [
            {
                done: false,
                id: 'todo-1',
                title: 'Open the Nekuta custom inspector'
            },
            {
                done: true,
                id: 'todo-2',
                title: 'Verify editable Vite-delivered state'
            }
        ],
        nextId: 3
    })
});

export function NekutaDemos() {
    const nekuta = useMemo(() => createNekuta(), []);
    useViteCounterStore(nekuta);
    useViteTodoStore(nekuta);

    useEffect(() => {
        registerNekutaDevTools({
            label: 'Nekuta Vite Playground',
            nekuta
        });
    }, [nekuta]);

    return (
        <NekutaStore nekuta={nekuta}>
            <section aria-labelledby="nekuta-demos-heading">
                <h2 id="nekuta-demos-heading">Nekuta store fixtures</h2>
                <p>
                    Real Nekuta stores served through the Vite plugin delivery
                    mode for custom inspector state and live-edit UAT.
                </p>
                <div className="grid">
                    <CounterStoreDemo />
                    <TodoStoreDemo />
                </div>
            </section>
        </NekutaStore>
    );
}

export function CounterStoreDemo() {
    const counter = useSubscribedStore(useViteCounterStore);

    return (
        <article className="card">
            <h3>Nekuta counter store</h3>
            <p>
                Count:{' '}
                <strong data-testid="nekuta-counter-count">
                    {counter.count}
                </strong>
            </p>
            <p>
                Doubled:{' '}
                <strong data-testid="nekuta-counter-doubled">
                    {counter.doubled}
                </strong>
            </p>
            <div className="buttons">
                <button onClick={() => counter.increment()}>Increment</button>
                <button onClick={() => counter.reset()}>Reset</button>
            </div>
        </article>
    );
}

export function TodoStoreDemo() {
    const todos = useSubscribedStore(useViteTodoStore);

    return (
        <article className="card">
            <h3>Nekuta todo store</h3>
            <p>
                Open todos:{' '}
                <strong data-testid="nekuta-open-todos">
                    {todos.openCount}
                </strong>
            </p>
            <div className="buttons">
                <button onClick={() => todos.addTodo('Review panel edit')}>
                    Add todo
                </button>
                <button onClick={() => todos.toggleTodo('todo-1')}>
                    Toggle first todo
                </button>
            </div>
            <ul className="log" data-testid="nekuta-todo-list">
                {todos.items.map((todo) => (
                    <li key={todo.id}>
                        {todo.done ? 'done' : 'open'}: {todo.title}
                    </li>
                ))}
            </ul>
        </article>
    );
}

function useSubscribedStore<TStore extends StoreGeneric>(
    useStoreDefinition: StoreAccessor<TStore>
): TStore {
    const store = useStore(useStoreDefinition);
    const [, forceRender] = useState(0);

    useEffect(() => {
        const rerender = () => {
            forceRender((value) => value + 1);
        };
        const unsubscribe = store.$subscribe(rerender, { detached: true });
        const intervalId = window.setInterval(rerender, 100);

        return () => {
            unsubscribe();
            window.clearInterval(intervalId);
        };
    }, [store]);

    return store;
}
