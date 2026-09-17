import {
    getReactFiberTagName,
    getReactMajorVersion,
    isInspectableReactFiberTag,
    ReactFiberTag,
    validateReactFiber,
    validateReactFiberRoot,
    validateReactRenderer
} from '../src/fiber.js';
import type { ReactFiber, ReactFiberRoot } from '../src/fiber.js';

describe('React Fiber model guards', () => {
    it('accepts React 18 and React 19 renderer versions', () => {
        expect(
            validateReactRenderer(
                {
                    bundleType: 1,
                    rendererPackageName: 'react-dom',
                    version: '18.3.1'
                },
                { rendererId: 18, targetId: 'top', timestamp: 100 }
            )
        ).toMatchObject({
            ok: true,
            value: { version: '18.3.1' }
        });
        expect(
            validateReactRenderer(
                {
                    bundleType: 1,
                    rendererPackageName: 'react-dom',
                    version: '19.0.0'
                },
                { rendererId: 19, targetId: 'top', timestamp: 100 }
            )
        ).toMatchObject({
            ok: true,
            value: { version: '19.0.0' }
        });
    });

    it('reports unsupported or missing renderer versions as diagnostics', () => {
        expect(
            validateReactRenderer(
                { rendererPackageName: 'react-dom', version: '17.0.2' },
                { rendererId: 17, targetId: 'legacy', timestamp: 123 }
            )
        ).toEqual({
            diagnostics: [
                expect.objectContaining({
                    code: 'renderer-version-unsupported',
                    details: {
                        supportedMajors: [18, 19],
                        version: '17.0.2'
                    },
                    rendererId: 17,
                    severity: 'warning',
                    targetId: 'legacy',
                    timestamp: 123
                })
            ],
            ok: false
        });

        expect(
            validateReactRenderer(
                { rendererPackageName: 'react-dom' },
                { rendererId: 'unknown', timestamp: 125 }
            )
        ).toEqual({
            diagnostics: [
                expect.objectContaining({
                    code: 'renderer-version-unsupported',
                    severity: 'error'
                })
            ],
            ok: false
        });
    });

    it('validates React 18 and React 19 root shapes without raw any casts', () => {
        const react18Root = createFiberRootFixture('18');
        const react19Root = createFiberRootFixture('19');

        expect(
            validateReactFiberRoot(react18Root, {
                rendererId: 18,
                rootId: 'root:18',
                targetId: 'top',
                timestamp: 200
            })
        ).toMatchObject({
            ok: true,
            value: {
                current: {
                    tag: ReactFiberTag.HostRoot
                }
            }
        });
        expect(
            validateReactFiberRoot(react19Root, {
                rendererId: 19,
                rootId: 'root:19',
                targetId: 'top',
                timestamp: 201
            })
        ).toMatchObject({
            ok: true,
            value: {
                current: {
                    tag: ReactFiberTag.HostRoot
                }
            }
        });
    });

    it('reports missing root and fiber fields as typed diagnostics', () => {
        expect(
            validateReactFiberRoot(
                { containerInfo: {} },
                {
                    rendererId: 1,
                    rootId: 'root:missing',
                    targetId: 'top',
                    timestamp: 300
                }
            )
        ).toEqual({
            diagnostics: [
                expect.objectContaining({
                    code: 'fiber-field-missing',
                    details: { field: 'current', target: 'FiberRoot' },
                    rootId: 'root:missing',
                    severity: 'error'
                })
            ],
            ok: false
        });

        expect(
            validateReactFiber(
                { tag: ReactFiberTag.FunctionComponent },
                { rendererId: 1, targetId: 'top', timestamp: 301 }
            )
        ).toEqual({
            diagnostics: [
                expect.objectContaining({
                    code: 'fiber-field-missing',
                    details: { field: 'alternate', target: 'Fiber' },
                    severity: 'error'
                })
            ],
            ok: false
        });
    });

    it('maps supported WorkTag values for display and traversal decisions', () => {
        expect(getReactFiberTagName(ReactFiberTag.FunctionComponent)).toBe(
            'FunctionComponent'
        );
        expect(getReactFiberTagName(ReactFiberTag.ClassComponent)).toBe(
            'ClassComponent'
        );
        expect(getReactFiberTagName(ReactFiberTag.HostRoot)).toBe('HostRoot');
        expect(getReactFiberTagName(ReactFiberTag.HostComponent)).toBe(
            'HostComponent'
        );
        expect(getReactFiberTagName(ReactFiberTag.Fragment)).toBe('Fragment');
        expect(getReactFiberTagName(ReactFiberTag.ContextProvider)).toBe(
            'ContextProvider'
        );
        expect(getReactFiberTagName(ReactFiberTag.ContextConsumer)).toBe(
            'ContextConsumer'
        );
        expect(getReactFiberTagName(ReactFiberTag.ForwardRef)).toBe(
            'ForwardRef'
        );
        expect(getReactFiberTagName(ReactFiberTag.MemoComponent)).toBe('Memo');
        expect(getReactFiberTagName(ReactFiberTag.LazyComponent)).toBe('Lazy');
        expect(getReactFiberTagName(ReactFiberTag.SuspenseComponent)).toBe(
            'Suspense'
        );
        expect(getReactFiberTagName(ReactFiberTag.OffscreenComponent)).toBe(
            'Offscreen'
        );
        expect(getReactFiberTagName(ReactFiberTag.Profiler)).toBe('Profiler');
        expect(getReactFiberTagName(ReactFiberTag.HostPortal)).toBe(
            'HostPortal'
        );
        expect(getReactFiberTagName(999)).toBe('Unknown(999)');
        expect(isInspectableReactFiberTag(ReactFiberTag.HostText)).toBe(false);
    });

    it('parses React major versions defensively', () => {
        expect(getReactMajorVersion('18.2.0')).toBe(18);
        expect(getReactMajorVersion('19.0.0-rc-123')).toBe(19);
        expect(getReactMajorVersion(undefined)).toBeNull();
        expect(getReactMajorVersion('experimental')).toBeNull();
    });
});

function createFiberRootFixture(version: '18' | '19'): ReactFiberRoot {
    const hostRoot = createFiberFixture({
        memoizedState:
            version === '18'
                ? { cache: null, element: null, isDehydrated: false }
                : {
                      cache: null,
                      element: null,
                      isDehydrated: false,
                      transition: null
                  },
        tag: ReactFiberTag.HostRoot
    });
    const app = createFiberFixture({
        returnFiber: hostRoot,
        tag: ReactFiberTag.FunctionComponent,
        type: function App() {
            return null;
        }
    });

    hostRoot.child = app;

    return {
        callbackNode: null,
        containerInfo: { nodeType: 1 },
        current: hostRoot,
        finishedWork: null,
        identifierPrefix: '',
        pendingChildren: null,
        pendingLanes: 0,
        tag: 1
    };
}

function createFiberFixture(options: {
    memoizedState?: unknown;
    returnFiber?: null | ReactFiber;
    tag: ReactFiberTag;
    type?: unknown;
}): ReactFiber {
    return {
        actualDuration: 0,
        actualStartTime: -1,
        alternate: null,
        child: null,
        childLanes: 0,
        deletions: null,
        dependencies: null,
        elementType: options.type ?? null,
        flags: 0,
        index: 0,
        key: null,
        lanes: 0,
        memoizedProps: null,
        memoizedState: options.memoizedState ?? null,
        mode: 1,
        pendingProps: null,
        ref: null,
        return: options.returnFiber ?? null,
        selfBaseDuration: 0,
        sibling: null,
        stateNode: null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: options.type ?? null,
        updateQueue: null
    };
}
