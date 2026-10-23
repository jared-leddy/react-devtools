import { useState } from 'react';
import { createRoot } from 'react-dom/client';

function R05Counter({ message }: { message: string }) {
    const [count, setCount] = useState(0);
    return (
        <main>
            <h1>R05 unannotated React fixture</h1>
            <p>{message}</p>
            <output id="count">{count}</output>
            <button
                id="increment"
                onClick={() => setCount((value) => value + 1)}
            >
                Increment
            </button>
        </main>
    );
}

const root = createRoot(document.getElementById('app')!);
if (location.pathname.includes('empty')) {
    root.render(null);
} else {
    root.render(<R05Counter message="R05 observed prop" />);
}
