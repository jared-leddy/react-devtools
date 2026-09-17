import {
    findNearestInspectableOwnerFiber,
    findReactRootBoundaryFiber,
    getReactContextDisplayName,
    getReactFiberTagName,
    getReactMajorVersion,
    getReactFiberFromHostInstance,
    inspectReactFiberContexts,
    isInspectableReactFiberTag,
    isReactContextConsumerFiber,
    isReactContextProviderFiber,
    ReactFiberTag,
    resolveReactFiberFromHostInstance,
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

    it('identifies context provider fibers and exposes their values', () => {
        const themeContext = {
            _currentValue: 'fallback',
            displayName: 'ThemeContext'
        };
        const provider = createFiberFixture({
            memoizedProps: { value: 'dark' },
            tag: ReactFiberTag.ContextProvider,
            type: {
                _context: themeContext
            }
        });

        expect(isReactContextProviderFiber(provider)).toBe(true);
        expect(inspectReactFiberContexts(provider)).toEqual([
            {
                displayName: 'ThemeContext',
                kind: 'provider',
                value: 'dark'
            }
        ]);
    });

    it('supports React 19 renderable context provider fibers', () => {
        const localeContext = {
            _currentValue: 'en-US',
            Consumer: {},
            Provider: {},
            displayName: 'LocaleContext'
        };
        const provider = createFiberFixture({
            pendingProps: { value: 'fr-CA' },
            tag: ReactFiberTag.ContextProvider,
            type: localeContext
        });

        expect(inspectReactFiberContexts(provider)).toEqual([
            {
                displayName: 'LocaleContext',
                kind: 'provider',
                value: 'fr-CA'
            }
        ]);
    });

    it('identifies context consumers and dependency records', () => {
        const themeContext = {
            _currentValue: 'quiet',
            displayName: 'ThemeContext'
        };
        const localeContext = {
            _currentValue: 'en-US',
            displayName: 'LocaleContext'
        };
        const consumer = createFiberFixture({
            dependencies: {
                firstContext: {
                    context: localeContext,
                    memoizedValue: 'de-DE',
                    observedBits: 7
                }
            },
            tag: ReactFiberTag.ContextConsumer,
            type: {
                _context: themeContext
            }
        });

        expect(isReactContextConsumerFiber(consumer)).toBe(true);
        expect(inspectReactFiberContexts(consumer)).toEqual([
            {
                displayName: 'ThemeContext',
                kind: 'consumer'
            },
            {
                displayName: 'LocaleContext',
                kind: 'dependency',
                observedBits: 7,
                value: 'de-DE'
            }
        ]);
    });

    it('falls back for anonymous contexts and malformed dependency chains', () => {
        const cyclicDependency: Record<string, unknown> = {
            context: {},
            memoizedValue: 'anonymous'
        };
        cyclicDependency.next = cyclicDependency;

        const provider = createFiberFixture({
            dependencies: { firstContext: cyclicDependency },
            tag: ReactFiberTag.ContextProvider,
            type: { _context: {} }
        });

        expect(getReactContextDisplayName({ displayName: '' })).toBe('Context');
        expect(inspectReactFiberContexts(provider)).toEqual([
            {
                displayName: 'Context',
                kind: 'provider'
            },
            {
                displayName: 'Context',
                kind: 'dependency',
                value: 'anonymous'
            }
        ]);
    });

    it('discovers React Fiber keys on host nodes without hardcoding suffixes', () => {
        const hostFiber = createFiberFixture({
            tag: ReactFiberTag.HostComponent,
            type: 'button'
        });
        const hostNode = createHostNodeFixture();

        attachReactFiber(
            hostNode,
            '__reactFiber$random-build-suffix',
            hostFiber
        );

        expect(getReactFiberFromHostInstance(hostNode)).toEqual({
            fiber: hostFiber,
            internalKey: '__reactFiber$random-build-suffix'
        });
    });

    it('falls back from text nodes to the closest host parent Fiber', () => {
        const component = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: function Label() {
                return null;
            }
        });
        const hostFiber = createFiberFixture({
            returnFiber: component,
            tag: ReactFiberTag.HostComponent,
            type: 'span'
        });
        const parentNode = createHostNodeFixture();
        const textNode = createHostNodeFixture({ nodeType: 3, parentNode });

        attachReactFiber(parentNode, '__reactFiber$text-parent', hostFiber);

        expect(
            resolveReactFiberFromHostInstance(textNode, {
                rendererId: 1,
                rootId: 'root:text',
                targetId: 'top',
                timestamp: 400
            })
        ).toMatchObject({
            diagnostics: [],
            fiber: hostFiber,
            inspectedFiber: component,
            internalKey: '__reactFiber$text-parent'
        });
    });

    it('walks from nested host fibers to the nearest composite owner', () => {
        const app = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: function App() {
                return null;
            }
        });
        const fragment = createFiberFixture({
            returnFiber: app,
            tag: ReactFiberTag.Fragment
        });
        const button = createFiberFixture({
            returnFiber: fragment,
            tag: ReactFiberTag.HostComponent,
            type: 'button'
        });
        const hostNode = createHostNodeFixture();

        attachReactFiber(hostNode, '__reactInternalInstance$nested', button);

        const resolved = resolveReactFiberFromHostInstance(hostNode, {
            rendererId: 1,
            rootId: 'root:nested',
            targetId: 'top',
            timestamp: 401
        });

        expect(resolved).toMatchObject({
            diagnostics: [],
            fiber: button,
            inspectedFiber: app,
            internalKey: '__reactInternalInstance$nested'
        });
        expect(findNearestInspectableOwnerFiber(button)).toBe(app);
    });

    it('keeps portal roots distinct while resolving portal content owners', () => {
        const root = createFiberFixture({ tag: ReactFiberTag.HostRoot });
        const portal = createFiberFixture({
            returnFiber: root,
            tag: ReactFiberTag.HostPortal
        });
        const modal = createFiberFixture({
            returnFiber: portal,
            tag: ReactFiberTag.FunctionComponent,
            type: function Modal() {
                return null;
            }
        });
        const host = createFiberFixture({
            returnFiber: modal,
            tag: ReactFiberTag.HostComponent,
            type: 'div'
        });
        const hostNode = createHostNodeFixture();

        attachReactFiber(hostNode, '__reactFiber$portal', host);

        expect(
            resolveReactFiberFromHostInstance(hostNode, {
                rendererId: 1,
                rootId: 'root:portal',
                targetId: 'top',
                timestamp: 402
            })
        ).toMatchObject({
            diagnostics: [],
            fiber: host,
            inspectedFiber: modal,
            rootFiber: portal
        });
        expect(findReactRootBoundaryFiber(host)).toBe(portal);
    });

    it('walks across Suspense and Offscreen boundaries to find composite owners', () => {
        const app = createFiberFixture({
            tag: ReactFiberTag.FunctionComponent,
            type: function App() {
                return null;
            }
        });
        const suspense = createFiberFixture({
            returnFiber: app,
            tag: ReactFiberTag.SuspenseComponent
        });
        const offscreen = createFiberFixture({
            returnFiber: suspense,
            tag: ReactFiberTag.OffscreenComponent
        });
        const host = createFiberFixture({
            returnFiber: offscreen,
            tag: ReactFiberTag.HostComponent,
            type: 'section'
        });

        expect(findNearestInspectableOwnerFiber(host)).toBe(app);
    });

    it('reports a typed diagnostic when a host node has no React Fiber key', () => {
        expect(
            resolveReactFiberFromHostInstance(createHostNodeFixture(), {
                rendererId: 1,
                targetId: 'top',
                timestamp: 403
            })
        ).toEqual({
            diagnostics: [
                expect.objectContaining({
                    code: 'fiber-host-node-unavailable',
                    severity: 'warning',
                    targetId: 'top',
                    timestamp: 403
                })
            ],
            fiber: null,
            hostFiber: null,
            inspectedFiber: null,
            internalKey: null,
            rootFiber: null
        });
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
    dependencies?: ReactFiber['dependencies'];
    memoizedProps?: unknown;
    memoizedState?: unknown;
    pendingProps?: unknown;
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
        dependencies: options.dependencies ?? null,
        elementType: options.type ?? null,
        flags: 0,
        index: 0,
        key: null,
        lanes: 0,
        memoizedProps: options.memoizedProps ?? null,
        memoizedState: options.memoizedState ?? null,
        mode: 1,
        pendingProps: options.pendingProps ?? null,
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

function attachReactFiber(
    hostNode: Record<PropertyKey, unknown>,
    key: string,
    fiber: ReactFiber
): void {
    Object.defineProperty(hostNode, key, {
        configurable: true,
        enumerable: false,
        value: fiber
    });
}

function createHostNodeFixture(
    options: {
        nodeType?: number;
        parentNode?: null | Record<PropertyKey, unknown>;
    } = {}
): Record<PropertyKey, unknown> {
    return {
        nodeType: options.nodeType ?? 1,
        parentNode: options.parentNode ?? null
    };
}
