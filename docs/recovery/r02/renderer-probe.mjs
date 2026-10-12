import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createDevToolsHook } from '@devtools/kit';
import { createFiberWalker } from '@devtools/core/fiber-walker';
import { getHooks, getProps } from '@devtools/core/fiber/state';
import { inspectReactFiberContexts } from '@devtools/core/fiber';

// This is a real renderer in DOM emulation, not native-panel or RPC evidence.
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost/r02-renderer-probe'
});
for (const key of ['window', 'document', 'HTMLElement', 'Node']) {
    globalThis[key] = key === 'window' ? dom.window : dom.window[key];
}
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator
});
const late = process.argv.includes('--late');
const install = () => createDevToolsHook({ target: globalThis });
let installation = late ? undefined : install();
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const Context = React.createContext('quiet');
Context.displayName = 'ProbeContext';
function Counter({ label }) {
    const [count, setCount] = React.useState(7);
    const context = React.useContext(Context);
    return React.createElement(
        'button',
        {
            id: 'hook-counter',
            onClick: () => setCount((value) => value + 1)
        },
        `${label}: ${count}; ${context}`
    );
}
const MemoCounter = React.memo(Counter);
MemoCounter.displayName = 'ProbeMemoCounter';
const Forward = React.forwardRef(function ForwardButton(_props, ref) {
    return React.createElement('span', { ref }, 'Forward');
});
Forward.displayName = 'ProbeForward';
class ClassCounter extends React.Component {
    state = { count: 11 };
    render() {
        return React.createElement(
            'button',
            {
                id: 'class-counter',
                onClick: () => this.setState({ count: this.state.count + 1 })
            },
            `Class: ${this.state.count}`
        );
    }
}
function ProbeApp() {
    return React.createElement(
        Context.Provider,
        { value: 'quiet' },
        React.createElement(MemoCounter, { label: 'R02 counter' }),
        React.createElement(Forward),
        React.createElement(ClassCounter)
    );
}
const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(React.createElement(ProbeApp)));
installation ??= install();
const hook = installation.hook;
const rootRecords = [...hook.renderers].flatMap(([id, renderer]) =>
    [...hook.getFiberRoots(id)].map((fiberRoot) => ({
        id,
        renderer,
        fiberRoot
    }))
);
function snapshot() {
    const fibers = [];
    function visit(fiber) {
        if (!fiber) return;
        fibers.push(fiber);
        visit(fiber.child);
        visit(fiber.sibling);
    }
    const records = rootRecords.map(({ id, renderer, fiberRoot }) => {
        visit(fiberRoot.current);
        return {
            rendererId: id,
            version: renderer.version,
            tree: createFiberWalker().getComponentTree(fiberRoot)
        };
    });
    const counter = fibers.find(
        (fiber) => fiber.memoizedProps?.label === 'R02 counter'
    );
    const klass = fibers.find((fiber) => fiber.tag === 1);
    return {
        records,
        counter: counter
            ? {
                  props: getProps(counter),
                  hooks: getHooks(counter),
                  contexts: inspectReactFiberContexts(counter)
              }
            : null,
        klass: klass
            ? {
                  actualState: klass.memoizedState,
                  currentGenericHookInspection: getHooks(klass)
              }
            : null,
        appText: document.body.textContent
    };
}
const before = snapshot();
flushSync(() => {
    document.getElementById('hook-counter').click();
    document.getElementById('class-counter').click();
});
const after = snapshot();
assert.match(before.appText, /R02 counter: 7; quiet/);
assert.match(after.appText, /R02 counter: 8; quiet/);
assert.match(after.appText, /Class: 12/);
if (late) {
    assert.equal(rootRecords.length, 0);
} else {
    assert.equal(rootRecords.length, 1);
    assert.equal(before.counter.hooks[0].value, 7);
    assert.equal(after.counter.hooks[0].value, 8);
    assert.deepEqual(after.klass.actualState, { count: 12 });
}
console.log(
    JSON.stringify(
        {
            environment: process.env.NODE_ENV ?? 'development',
            hookTiming: late ? 'after-first-render' : 'before-renderer-import',
            react: React.version,
            jsdom: JSON.parse(
                readFileSync(
                    new URL(
                        '../../../node_modules/jsdom/package.json',
                        import.meta.url
                    )
                )
            ).version,
            probeSha256: createHash('sha256')
                .update(readFileSync(new URL(import.meta.url)))
                .digest('hex'),
            before,
            after,
            boundary:
                'Actual React renderer in jsdom; not native extension/panel, official backend, or RPC'
        },
        null,
        4
    )
);
flushSync(() => root.unmount());
dom.window.close();
