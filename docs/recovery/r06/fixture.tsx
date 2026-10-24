import {
    Component,
    Suspense,
    createContext,
    forwardRef,
    lazy,
    memo,
    useContext,
    useState
} from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

const Theme = createContext('initial');
Theme.displayName = 'FixtureTheme';

function PlainFunction() {
    return <span>Plain function</span>;
}
class NamedClass extends Component {
    render() {
        return <span>Named class</span>;
    }
}
Object.assign(NamedClass, { displayName: 'NamedClassFixture' });
const Memo = memo(function MemoInner() {
    return <span>Memo</span>;
});
Memo.displayName = 'MemoFixture';
const Forward = forwardRef<HTMLSpanElement>(function ForwardInner(_props, ref) {
    return <span ref={ref}>Forward ref</span>;
});
Forward.displayName = 'ForwardFixture';
const Nested = memo(Forward);
function LazyContent() {
    return <span>Resolved lazy child</span>;
}
Object.assign(LazyContent, { displayName: 'LazyContentFixture' });
let resolveLazy: (() => void) | undefined;
const Lazy = lazy(
    () =>
        new Promise<{ default: typeof LazyContent }>((resolve) => {
            resolveLazy = () => resolve({ default: LazyContent });
        })
);
function PortalLeaf() {
    return <button id="portal-target">Portal target</button>;
}
Object.assign(PortalLeaf, { displayName: 'PortalLeafFixture' });

function SelectableRow({ rowId }: { rowId: string }) {
    const [count, setCount] = useState(0);
    const theme = useContext(Theme);
    return (
        <article data-row={rowId}>
            <strong>Row {rowId}</strong>
            <output id={`count-${rowId}`}>{count}</output>
            <span>{theme}</span>
            <button
                id={`increment-${rowId}`}
                onClick={() => setCount((value) => value + 1)}
            >
                Increment {rowId}
            </button>
        </article>
    );
}
SelectableRow.displayName = 'SelectableRow';

function IdentityFixture() {
    const [order, setOrder] = useState(['a', 'b', 'c']);
    const [mounted, setMounted] = useState(true);
    const [theme, setTheme] = useState('initial');
    return (
        <Theme.Provider value={theme}>
            <main>
                <h1>R06 identity fixture</h1>
                <button
                    id="reorder"
                    onClick={() =>
                        setOrder((current) => [...current.slice(1), current[0]])
                    }
                >
                    Reorder keyed rows
                </button>
                <button id="remove-b" onClick={() => setMounted(false)}>
                    Unmount b
                </button>
                <button id="restore-b" onClick={() => setMounted(true)}>
                    Remount b
                </button>
                <button
                    id="rename"
                    onClick={() => {
                        SelectableRow.displayName = 'RenamedRow';
                        setTheme('renamed');
                    }}
                >
                    Rename display label
                </button>
                <button id="resolve-lazy" onClick={() => resolveLazy?.()}>
                    Resolve lazy
                </button>
                <section>
                    {order
                        .filter((id) => mounted || id !== 'b')
                        .map((id) => (
                            <SelectableRow key={id} rowId={id} />
                        ))}
                </section>
                <PlainFunction />
                <NamedClass />
                <Memo />
                <Forward />
                <Nested />
                <Theme.Consumer>
                    {(value) => <span>{value}</span>}
                </Theme.Consumer>
                <Suspense
                    fallback={<span id="pending-lazy">Loading lazy</span>}
                >
                    <Lazy />
                </Suspense>
                {createPortal(
                    <PortalLeaf />,
                    document.getElementById('portal')!
                )}
            </main>
        </Theme.Provider>
    );
}
Object.assign(IdentityFixture, { displayName: 'IdentityFixture' });
function OtherRoot() {
    return <aside>Separate root</aside>;
}
Object.assign(OtherRoot, { displayName: 'OtherRootFixture' });

let primary: Root | undefined;
let secondary: Root | undefined;
function mountPrimary() {
    primary = createRoot(document.getElementById('app')!);
    primary.render(<IdentityFixture />);
}
function mountSecondary() {
    secondary = createRoot(document.getElementById('secondary')!);
    secondary.render(<OtherRoot />);
}
document.getElementById('remove-primary')!.addEventListener('click', () => {
    primary?.unmount();
    primary = undefined;
});
document.getElementById('restore-primary')!.addEventListener('click', () => {
    if (!primary) mountPrimary();
});
document.getElementById('remove-secondary')!.addEventListener('click', () => {
    secondary?.unmount();
    secondary = undefined;
});
document.getElementById('restore-secondary')!.addEventListener('click', () => {
    if (!secondary) mountSecondary();
});
mountPrimary();
mountSecondary();
Object.assign(window, {
    __r06ExpectedNames: [
        PlainFunction.name,
        'NamedClassFixture',
        'MemoFixture',
        'ForwardFixture',
        'FixtureTheme.Provider',
        'FixtureTheme.Consumer',
        'Suspense',
        'Portal',
        'PortalLeafFixture',
        'OtherRootFixture'
    ]
});
