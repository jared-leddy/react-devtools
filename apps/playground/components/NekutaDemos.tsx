'use client';

import { useEffect, useMemo } from 'react';
import {
    createNekuta,
    defineStore,
    disposeNekuta,
    NekutaStore,
    useStore
} from '@nekuta/core';
import { registerNekutaDevTools } from '@devtools/nekuta-plugin';

export const usePlaygroundCounterStore = defineStore({
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
    id: 'playground-counter',
    state: () => ({
        count: 0
    })
});

export const usePlaygroundTodoStore = defineStore({
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
    id: 'playground-todos',
    state: () => ({
        items: [
            {
                done: false,
                id: 'todo-1',
                title: 'Inspect the counter store'
            },
            {
                done: true,
                id: 'todo-2',
                title: 'Verify editable Nekuta state'
            }
        ],
        nextId: 3
    })
});

export function NekutaDemos() {
    const nekuta = useMemo(() => createNekuta(), []);

    useEffect(() => {
        registerNekutaDevTools({
            label: 'Nekuta Playground',
            nekuta
        });

        return () => {
            disposeNekuta(nekuta);
        };
    }, [nekuta]);

    return (
        <NekutaStore nekuta={nekuta}>
            <section aria-labelledby="nekuta-demos-title">
                <h2 id="nekuta-demos-title">Nekuta store fixtures</h2>
                <p>
                    Real Nekuta stores for exercising custom inspector tree,
                    state, getters, actions, and live edits.
                </p>
                <div className="demo-grid">
                    <CounterStoreDemo />
                    <TodoStoreDemo />
                </div>
            </section>
        </NekutaStore>
    );
}

export function CounterStoreDemo() {
    const counter = useStore(usePlaygroundCounterStore);

    return (
        <article className="card">
            <h3>counter store</h3>
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
    const todos = useStore(usePlaygroundTodoStore);

    return (
        <article className="card">
            <h3>todo store</h3>
            <p>
                Open todos:{' '}
                <strong data-testid="nekuta-open-todos">
                    {todos.openCount}
                </strong>
            </p>
            <div className="buttons">
                <button onClick={() => todos.addTodo('Review timeline event')}>
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
