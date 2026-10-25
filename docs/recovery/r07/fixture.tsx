import {
    Component,
    createContext,
    useContext,
    useReducer,
    useState
} from 'react';
import { createRoot } from 'react-dom/client';
const Theme = createContext({ mode: 'light', revision: 0 });
Theme.displayName = 'FixtureTheme';
function useLeaf() {
    return useState(5);
}
function useNested() {
    return useLeaf();
}
class InspectorClass extends Component<
    { marker: string },
    { clicks: number; nested: { ready: boolean } }
> {
    static displayName = 'InspectorClass';
    static contextType = Theme;
    state = { clicks: 10, nested: { ready: true } };
    render() {
        return (
            <section>
                <output id="class-count">{this.state.clicks}</output>
                <button
                    id="class-update"
                    onClick={() =>
                        this.setState({ clicks: this.state.clicks + 1 })
                    }
                >
                    Class update
                </button>
            </section>
        );
    }
}
function InspectorFunction(props: { marker: string; typed: unknown }) {
    const [nested, setNested] = useNested();
    const [reducer, dispatch] = useReducer(
        (state: { count: number }) => ({ count: state.count + 1 }),
        { count: 2 }
    );
    const theme = useContext(Theme);
    return (
        <main>
            <h1>{props.marker}</h1>
            <output id="nested-count">{nested}</output>
            <output id="reducer-count">{reducer.count}</output>
            <span>{theme.mode}</span>
            <button
                id="function-update"
                onClick={() => {
                    setNested((value) => value + 1);
                    dispatch();
                }}
            >
                Function update
            </button>
            <InspectorClass marker="class-prop" />
        </main>
    );
}
InspectorFunction.displayName = 'InspectorFunction';
let revision = 0;
const root = createRoot(document.getElementById('app')!);
const typed = {
    missing: undefined,
    big: 42n,
    map: new Map([['key', 7]]),
    set: new Set(['member']),
    date: new Date('2026-01-02T00:00:00Z'),
    nan: NaN,
    large: Array.from({ length: 80 }, (_, index) => index),
    deep: { one: { two: { three: { four: { five: 1 } } } } }
};
Object.defineProperty(typed, 'accessor', {
    enumerable: true,
    get() {
        throw Error('Inspector must not evaluate this getter');
    }
});
function render() {
    root.render(
        <Theme.Provider value={{ mode: revision ? 'dark' : 'light', revision }}>
            <InspectorFunction marker={`R07 props ${revision}`} typed={typed} />
        </Theme.Provider>
    );
}
document.getElementById('update-app')!.addEventListener('click', () => {
    revision++;
    render();
});
document
    .getElementById('remove-app')!
    .addEventListener('click', () => root.unmount());
render();
