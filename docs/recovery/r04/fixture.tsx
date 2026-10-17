import { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

let secondary: Root | undefined;
function Leaf() {
    return <p>Mounted child</p>;
}
function Secondary() {
    return <p>Secondary root</p>;
}
function CounterFixture() {
    const [count, setCount] = useState(0);
    const [child, setChild] = useState(true);
    const [mounted, setMounted] = useState(false);
    return (
        <main>
            <h1>R04 React commit fixture</h1>
            <p id="counter">Counter {count}</p>
            <button
                id="increment"
                onClick={() => setCount((value) => value + 1)}
            >
                Increment
            </button>
            <button
                id="burst"
                onClick={() => {
                    for (let index = 0; index < 25; index++)
                        flushSync(() => setCount((value) => value + 1));
                }}
            >
                Commit burst
            </button>
            <button
                id="toggle-child"
                onClick={() => setChild((value) => !value)}
            >
                Toggle child
            </button>
            <button
                id="mount-secondary"
                disabled={mounted}
                onClick={() => {
                    secondary = createRoot(
                        document.getElementById('secondary')!
                    );
                    secondary.render(<Secondary />);
                    setMounted(true);
                }}
            >
                Mount secondary
            </button>
            <button
                id="unmount-secondary"
                disabled={!mounted}
                onClick={() => {
                    secondary?.unmount();
                    secondary = undefined;
                    setMounted(false);
                }}
            >
                Unmount secondary
            </button>
            {child && <Leaf />}
        </main>
    );
}
createRoot(document.getElementById('root')!).render(<CounterFixture />);
