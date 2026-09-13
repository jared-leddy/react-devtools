'use client';

import { useMemo, useState, type FormEvent } from 'react';

interface TodoItem {
    id: number;
    text: string;
    done: boolean;
}

export function TodoDemo() {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [nextId, setNextId] = useState(1);
    const [text, setText] = useState('');
    const completedCount = useMemo(
        () => items.filter((item) => item.done).length,
        [items]
    );
    const remainingCount = items.length - completedCount;

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = text.trim();

        if (!trimmed) {
            return;
        }

        setItems((currentItems) => [
            ...currentItems,
            { id: nextId, text: trimmed, done: false }
        ]);
        setNextId((value) => value + 1);
        setText('');
    }

    return (
        <section>
            <h2>Todo demo</h2>
            <p>
                remaining: <strong>{remainingCount}</strong> · completed:{' '}
                <strong>{completedCount}</strong>
            </p>

            <form onSubmit={handleSubmit} className="buttons">
                <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Add a todo…"
                />
                <button type="submit">add</button>
                <button
                    type="button"
                    onClick={() =>
                        setItems((currentItems) =>
                            currentItems.filter((item) => !item.done)
                        )
                    }
                >
                    clear completed
                </button>
            </form>

            <ul>
                {items.map((item) => (
                    <li key={item.id}>
                        <label>
                            <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() =>
                                    setItems((currentItems) =>
                                        currentItems.map((currentItem) =>
                                            currentItem.id === item.id
                                                ? {
                                                      ...currentItem,
                                                      done: !currentItem.done
                                                  }
                                                : currentItem
                                        )
                                    )
                                }
                            />
                            <span
                                style={{
                                    textDecoration: item.done
                                        ? 'line-through'
                                        : 'none'
                                }}
                            >
                                {item.text}
                            </span>
                        </label>
                        <button
                            onClick={() =>
                                setItems((currentItems) =>
                                    currentItems.filter(
                                        (currentItem) =>
                                            currentItem.id !== item.id
                                    )
                                )
                            }
                        >
                            remove
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
