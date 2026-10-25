import { useMemo, useState } from 'react';
export default function LifecycleApp({ marker }: { marker: string }) {
    const [count, setCount] = useState(0);
    const version = 'R08_VERSION';
    const sourceVersion = useMemo(() => version, [version]);
    return (
        <main>
            <h1>{marker}</h1>
            <output id="counter">{count}</output>
            <span id="source-version">{sourceVersion}</span>
            <button
                id="increment"
                onClick={() => setCount((value) => value + 1)}
            >
                Increment
            </button>
        </main>
    );
}
LifecycleApp.displayName = 'LifecycleApp';
