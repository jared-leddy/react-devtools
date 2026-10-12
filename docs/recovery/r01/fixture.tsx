import React, { Component, createContext, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';

const BaselineContext = createContext('quiet');
BaselineContext.displayName = 'BaselineContext';

function BaselineCounter({ label }: { label: string }) {
    const [count, setCount] = useState(7);
    const tone = useContext(BaselineContext);

    return (
        <section>
            <h2>{label}</h2>
            <p>
                Hook count: {count}; context: {tone}
            </p>
            <button onClick={() => setCount(count + 1)}>
                Increment hook counter
            </button>
        </section>
    );
}

class BaselineClassCounter extends Component<object, { count: number }> {
    state = { count: 11 };

    render() {
        return (
            <section>
                <h2>Class counter</h2>
                <p>Class count: {this.state.count}</p>
                <button
                    onClick={() =>
                        this.setState({ count: this.state.count + 1 })
                    }
                >
                    Increment class counter
                </button>
            </section>
        );
    }
}

function BaselineApp() {
    return (
        <main>
            <h1>R01 unannotated React baseline</h1>
            <BaselineContext.Provider value="quiet">
                <BaselineCounter label="R01 counter" />
                <BaselineClassCounter />
            </BaselineContext.Provider>
        </main>
    );
}

createRoot(document.getElementById('root')!).render(<BaselineApp />);
