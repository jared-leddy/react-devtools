import {
    Component,
    Suspense,
    createContext,
    lazy,
    memo,
    useContext,
    useReducer,
    useState,
    type ComponentType
} from 'react';

type ThemeTone = 'quiet' | 'active';
type LocaleCode = 'en-US' | 'fr-CA';

const ThemeContext = createContext<ThemeTone>('quiet');
ThemeContext.displayName = 'ThemeContext';

const LocaleContext = createContext<LocaleCode>('en-US');
LocaleContext.displayName = 'LocaleContext';

const AnonymousContext = createContext('anonymous-default');

function reducer(state: number, action: 'increment' | 'decrement' | 'reset') {
    switch (action) {
        case 'increment':
            return state + 1;
        case 'decrement':
            return state - 1;
        case 'reset':
            return 0;
    }
}

function createLazyPanel() {
    return lazy(
        () =>
            new Promise<{ default: ComponentType }>((resolve) => {
                setTimeout(() => {
                    resolve({
                        default: function LazyPanel() {
                            return (
                                <div
                                    className="demo-result"
                                    data-testid="lazy-panel"
                                >
                                    Lazy child resolved
                                </div>
                            );
                        }
                    });
                }, 10);
            })
    );
}

const LazyPanel = createLazyPanel();

export function StateCounterDemo() {
    const [count, setCount] = useState(0);

    return (
        <article className="card">
            <h3>useState component</h3>
            <p>
                Count: <strong data-testid="state-count">{count}</strong>
            </p>
            <div className="buttons">
                <button onClick={() => setCount((value) => value + 1)}>
                    Increment
                </button>
                <button onClick={() => setCount(0)}>Reset</button>
            </div>
        </article>
    );
}

export function ReducerCounterDemo() {
    const [count, dispatch] = useReducer(reducer, 0);

    return (
        <article className="card">
            <h3>useReducer component</h3>
            <p>
                Count: <strong data-testid="reducer-count">{count}</strong>
            </p>
            <div className="buttons">
                <button onClick={() => dispatch('increment')}>Increment</button>
                <button onClick={() => dispatch('decrement')}>Decrement</button>
                <button onClick={() => dispatch('reset')}>Reset</button>
            </div>
        </article>
    );
}

function ContextConsumerDemo() {
    const tone = useContext(ThemeContext);
    const locale = useContext(LocaleContext);
    const anonymousValue = useContext(AnonymousContext);

    return (
        <div className="demo-result" data-testid="context-values">
            Current context tone: {tone}; locale: {locale}; anonymous:{' '}
            {anonymousValue}
        </div>
    );
}

export function ContextProviderDemo() {
    const [tone, setTone] = useState<ThemeTone>('quiet');
    const [locale, setLocale] = useState<LocaleCode>('en-US');

    return (
        <ThemeContext.Provider value={tone}>
            <LocaleContext.Provider value={locale}>
                <AnonymousContext.Provider value="anonymous-nested">
                    <article className="card">
                        <h3>nested context providers</h3>
                        <ContextConsumerDemo />
                        <div className="buttons">
                            <button onClick={() => setTone('active')}>
                                Set active
                            </button>
                            <button onClick={() => setTone('quiet')}>
                                Set quiet
                            </button>
                            <button onClick={() => setLocale('fr-CA')}>
                                Set French Canada
                            </button>
                            <button onClick={() => setLocale('en-US')}>
                                Set US English
                            </button>
                        </div>
                    </article>
                </AnonymousContext.Provider>
            </LocaleContext.Provider>
        </ThemeContext.Provider>
    );
}

function MemoStatusBase({ label }: { label: string }) {
    const [selected, setSelected] = useState(false);

    return (
        <article className="card">
            <h3>memo component</h3>
            <p data-testid="memo-status">
                {label}: {selected ? 'selected' : 'idle'}
            </p>
            <button onClick={() => setSelected((value) => !value)}>
                Toggle memo state
            </button>
        </article>
    );
}

export const MemoStatusDemo = memo(MemoStatusBase);

export function SuspenseLazyDemo() {
    return (
        <article className="card">
            <h3>Suspense boundary</h3>
            <Suspense
                fallback={
                    <div className="demo-result" data-testid="lazy-fallback">
                        Loading lazy child...
                    </div>
                }
            >
                <LazyPanel />
            </Suspense>
        </article>
    );
}

export class ClassStateDemo extends Component<object, { count: number }> {
    public state = { count: 0 };

    public override render() {
        return (
            <article className="card">
                <h3>class component</h3>
                <p>
                    Count:{' '}
                    <strong data-testid="class-count">
                        {this.state.count}
                    </strong>
                </p>
                <button
                    onClick={() =>
                        this.setState((state) => ({
                            count: state.count + 1
                        }))
                    }
                >
                    Increment
                </button>
            </article>
        );
    }
}

export function PlainReactDemos() {
    return (
        <section aria-labelledby="plain-react-demos-heading">
            <h2 id="plain-react-demos-heading">Plain React fixtures</h2>
            <div className="demo-grid">
                <StateCounterDemo />
                <ReducerCounterDemo />
                <ContextProviderDemo />
                <MemoStatusDemo label="Memo status" />
                <SuspenseLazyDemo />
                <ClassStateDemo />
            </div>
        </section>
    );
}
