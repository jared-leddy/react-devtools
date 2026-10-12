import React, {
    createContext,
    forwardRef,
    memo,
    useContext,
    useState
} from 'react';
import { createRoot } from 'react-dom/client';

const Context = createContext('quiet');
Context.displayName = 'ProbeContext';

function Counter({ label }: { label: string }) {
    const [count, setCount] = useState(7);
    const context = useContext(Context);
    return (
        <section>
            <h2>{label}</h2>
            <p>
                Hook count: {count}; context: {context}
            </p>
            <button onClick={() => setCount((value) => value + 1)}>
                Increment hook counter
            </button>
        </section>
    );
}

const MemoCounter = memo(Counter);
MemoCounter.displayName = 'ProbeMemoCounter';
const Forward = forwardRef<HTMLSpanElement>(
    function ForwardButton(_props, ref) {
        return <span ref={ref}>Forward</span>;
    }
);
Forward.displayName = 'ProbeForward';

class ClassCounter extends React.Component {
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

function ProbeApp() {
    return (
        <>
            <h1>R02 wrapped-component comparison</h1>
            <Context.Provider value="quiet">
                <MemoCounter label="R02 counter" />
                <Forward />
                <ClassCounter />
            </Context.Provider>
        </>
    );
}

createRoot(document.getElementById('root')!).render(<ProbeApp />);
