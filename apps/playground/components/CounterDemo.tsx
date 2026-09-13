'use client';

import { useState } from 'react';

function CounterPanel({
    title,
    count,
    onIncrement,
    onDecrement,
    incrementLabel,
    decrementLabel,
    testId
}: {
    title: string;
    count: number;
    onIncrement: () => void;
    onDecrement: () => void;
    incrementLabel: string;
    decrementLabel: string;
    testId: string;
}) {
    const doubleCount = count * 2;

    return (
        <div className="card">
            <h3>{title}</h3>
            <p>
                count: <strong data-testid={testId}>{count}</strong> ·
                doubleCount: <strong>{doubleCount}</strong>
            </p>
            <div className="buttons">
                <button onClick={onIncrement}>{incrementLabel}</button>
                <button onClick={onDecrement}>{decrementLabel}</button>
            </div>
        </div>
    );
}

export function CounterDemo() {
    const [count, setCount] = useState(0);

    return (
        <section>
            <h2>Counter demo</h2>
            <div className="demo-grid">
                <CounterPanel
                    title="Functional state"
                    count={count}
                    onIncrement={() => setCount((value) => value + 1)}
                    onDecrement={() => setCount((value) => value - 1)}
                    incrementLabel="+1"
                    decrementLabel="-1"
                    testId="functional-count"
                />
                <CounterPanel
                    title="Shared state view"
                    count={count}
                    onIncrement={() => setCount((value) => value + 5)}
                    onDecrement={() => setCount((value) => value - 5)}
                    incrementLabel="+5"
                    decrementLabel="-5"
                    testId="class-count"
                />
                <CounterPanel
                    title="Derived state view"
                    count={count}
                    onIncrement={() => setCount((value) => value + 10)}
                    onDecrement={() => setCount((value) => value - 10)}
                    incrementLabel="+10"
                    decrementLabel="-10"
                    testId="static-class-count"
                />
            </div>
            <button onClick={() => setCount(0)}>reset</button>
        </section>
    );
}
