import type { DetectionDiagnosticRecord } from './types.js';

export enum ReactFiberTag {
    FunctionComponent = 0,
    ClassComponent = 1,
    IndeterminateComponent = 2,
    HostRoot = 3,
    HostPortal = 4,
    HostComponent = 5,
    HostText = 6,
    Fragment = 7,
    Mode = 8,
    ContextConsumer = 9,
    ContextProvider = 10,
    ForwardRef = 11,
    Profiler = 12,
    SuspenseComponent = 13,
    MemoComponent = 14,
    SimpleMemoComponent = 15,
    LazyComponent = 16,
    IncompleteClassComponent = 17,
    DehydratedFragment = 18,
    SuspenseListComponent = 19,
    ScopeComponent = 21,
    OffscreenComponent = 22,
    LegacyHiddenComponent = 23,
    CacheComponent = 24,
    TracingMarkerComponent = 25
}

export const REACT_FIBER_TAG_LABELS: ReadonlyMap<number, string> = new Map([
    [ReactFiberTag.FunctionComponent, 'FunctionComponent'],
    [ReactFiberTag.ClassComponent, 'ClassComponent'],
    [ReactFiberTag.IndeterminateComponent, 'IndeterminateComponent'],
    [ReactFiberTag.HostRoot, 'HostRoot'],
    [ReactFiberTag.HostPortal, 'HostPortal'],
    [ReactFiberTag.HostComponent, 'HostComponent'],
    [ReactFiberTag.HostText, 'HostText'],
    [ReactFiberTag.Fragment, 'Fragment'],
    [ReactFiberTag.Mode, 'Mode'],
    [ReactFiberTag.ContextConsumer, 'ContextConsumer'],
    [ReactFiberTag.ContextProvider, 'ContextProvider'],
    [ReactFiberTag.ForwardRef, 'ForwardRef'],
    [ReactFiberTag.Profiler, 'Profiler'],
    [ReactFiberTag.SuspenseComponent, 'Suspense'],
    [ReactFiberTag.MemoComponent, 'Memo'],
    [ReactFiberTag.SimpleMemoComponent, 'SimpleMemo'],
    [ReactFiberTag.LazyComponent, 'Lazy'],
    [ReactFiberTag.IncompleteClassComponent, 'IncompleteClassComponent'],
    [ReactFiberTag.DehydratedFragment, 'DehydratedFragment'],
    [ReactFiberTag.SuspenseListComponent, 'SuspenseList'],
    [ReactFiberTag.ScopeComponent, 'Scope'],
    [ReactFiberTag.OffscreenComponent, 'Offscreen'],
    [ReactFiberTag.LegacyHiddenComponent, 'LegacyHidden'],
    [ReactFiberTag.CacheComponent, 'Cache'],
    [ReactFiberTag.TracingMarkerComponent, 'TracingMarker']
]);

export type SupportedReactMajorVersion = 18 | 19;
export type ReactFiberMode = number;
export type ReactFiberFlags = number;
export type ReactLaneSet = number;

export interface ReactFiberSourceLocation {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
}

export interface ReactFiberOwner {
    tag?: number;
    type?: unknown;
}

export interface ReactFiberDependencies {
    firstContext?: unknown;
    lanes?: ReactLaneSet;
}

export interface ReactFiber {
    _debugOwner?: null | ReactFiberOwner;
    _debugSource?: null | ReactFiberSourceLocation;
    actualDuration?: number;
    actualStartTime?: number;
    alternate: null | ReactFiber;
    child: null | ReactFiber;
    childLanes?: ReactLaneSet;
    deletions?: null | ReactFiber[];
    dependencies?: null | ReactFiberDependencies;
    elementType: unknown;
    flags: ReactFiberFlags;
    index: number;
    key: null | string;
    lanes?: ReactLaneSet;
    memoizedProps: unknown;
    memoizedState: unknown;
    mode: ReactFiberMode;
    pendingProps: unknown;
    ref?: unknown;
    return: null | ReactFiber;
    selfBaseDuration?: number;
    sibling: null | ReactFiber;
    stateNode: unknown;
    subtreeFlags?: ReactFiberFlags;
    tag: number;
    treeBaseDuration?: number;
    type: unknown;
    updateQueue?: unknown;
}

export interface ReactFiberHostNode {
    nodeType?: number;
    parentNode?: null | ReactFiberHostNode;
}

export interface ReactFiberRoot {
    callbackNode?: unknown;
    containerInfo?: unknown;
    current: ReactFiber;
    finishedWork?: null | ReactFiber;
    identifierPrefix?: string;
    pendingChildren?: unknown;
    pendingLanes?: ReactLaneSet;
    tag?: number;
}

export interface ReactRendererInterface {
    findFiberByHostInstance?: (hostInstance: unknown) => null | ReactFiber;
    getFiberIDForNative?: (hostInstance: unknown) => null | number | string;
    renderer?: ReactRendererRecord;
}

export interface ReactRendererRecord {
    bundleType?: number;
    findFiberByHostInstance?: (hostInstance: unknown) => null | ReactFiber;
    packageName?: string;
    rendererPackageName?: string;
    rendererConfig?: Record<PropertyKey, unknown>;
    rendererInterface?: ReactRendererInterface;
    version?: string;
}

export interface FiberGuardContext {
    rendererId?: number | string;
    rootId?: string;
    targetId?: string;
    timestamp?: number;
}

export interface FiberGuardSuccess<TValue> {
    diagnostics: DetectionDiagnosticRecord[];
    ok: true;
    value: TValue;
}

export interface FiberGuardFailure {
    diagnostics: DetectionDiagnosticRecord[];
    ok: false;
}

export type FiberGuardResult<TValue> =
    FiberGuardFailure | FiberGuardSuccess<TValue>;

export interface ReactFiberHostLookupResult {
    diagnostics: DetectionDiagnosticRecord[];
    fiber: null | ReactFiber;
    hostFiber: null | ReactFiber;
    inspectedFiber: null | ReactFiber;
    internalKey: null | string;
    rootFiber: null | ReactFiber;
}

export function getReactFiberTagName(tag: number): string {
    return REACT_FIBER_TAG_LABELS.get(tag) ?? `Unknown(${tag})`;
}

export function isKnownReactFiberTag(tag: number): tag is ReactFiberTag {
    return REACT_FIBER_TAG_LABELS.has(tag);
}

export function isInspectableReactFiberTag(tag: number): boolean {
    return (
        tag === ReactFiberTag.FunctionComponent ||
        tag === ReactFiberTag.ClassComponent ||
        tag === ReactFiberTag.HostRoot ||
        tag === ReactFiberTag.HostComponent ||
        tag === ReactFiberTag.Fragment ||
        tag === ReactFiberTag.ContextProvider ||
        tag === ReactFiberTag.ContextConsumer ||
        tag === ReactFiberTag.ForwardRef ||
        tag === ReactFiberTag.MemoComponent ||
        tag === ReactFiberTag.SimpleMemoComponent ||
        tag === ReactFiberTag.LazyComponent ||
        tag === ReactFiberTag.SuspenseComponent ||
        tag === ReactFiberTag.OffscreenComponent ||
        tag === ReactFiberTag.Profiler ||
        tag === ReactFiberTag.HostPortal
    );
}

export function isCompositeInspectableReactFiberTag(tag: number): boolean {
    return (
        tag === ReactFiberTag.FunctionComponent ||
        tag === ReactFiberTag.ClassComponent ||
        tag === ReactFiberTag.ContextProvider ||
        tag === ReactFiberTag.ContextConsumer ||
        tag === ReactFiberTag.ForwardRef ||
        tag === ReactFiberTag.MemoComponent ||
        tag === ReactFiberTag.SimpleMemoComponent ||
        tag === ReactFiberTag.LazyComponent ||
        tag === ReactFiberTag.Profiler
    );
}

export function isReactHostFiberTag(tag: number): boolean {
    return (
        tag === ReactFiberTag.HostComponent ||
        tag === ReactFiberTag.HostText ||
        tag === ReactFiberTag.HostRoot ||
        tag === ReactFiberTag.HostPortal
    );
}

export function isReactFiberBoundaryTag(tag: number): boolean {
    return (
        tag === ReactFiberTag.Fragment ||
        tag === ReactFiberTag.SuspenseComponent ||
        tag === ReactFiberTag.OffscreenComponent ||
        tag === ReactFiberTag.LegacyHiddenComponent ||
        tag === ReactFiberTag.CacheComponent
    );
}

export function getReactMajorVersion(
    version: null | string | undefined
): null | number {
    if (!version) {
        return null;
    }

    const major = Number.parseInt(version.split('.')[0] ?? '', 10);
    return Number.isFinite(major) ? major : null;
}

export function isSupportedReactMajorVersion(
    major: null | number
): major is SupportedReactMajorVersion {
    return major === 18 || major === 19;
}

export function validateReactRenderer(
    renderer: unknown,
    context: FiberGuardContext = {}
): FiberGuardResult<ReactRendererRecord> {
    if (!isRecord(renderer)) {
        return failure(
            createFiberDiagnostic('renderer-unsupported', {
                context,
                details: { reason: 'renderer-not-object' },
                message: 'React renderer internals are not an object.',
                severity: 'error'
            })
        );
    }

    const rendererRecord = renderer as ReactRendererRecord;
    const version =
        typeof rendererRecord.version === 'string'
            ? rendererRecord.version
            : undefined;
    const major = getReactMajorVersion(version);

    if (!isSupportedReactMajorVersion(major)) {
        return failure(
            createFiberDiagnostic('renderer-version-unsupported', {
                context,
                details: {
                    supportedMajors: [18, 19],
                    version
                },
                message: version
                    ? `React renderer version ${version} is not supported.`
                    : 'React renderer version is unavailable.',
                severity: version ? 'warning' : 'error'
            })
        );
    }

    return {
        diagnostics: [],
        ok: true,
        value: rendererRecord
    };
}

export function validateReactFiberRoot(
    root: unknown,
    context: FiberGuardContext = {}
): FiberGuardResult<ReactFiberRoot> {
    if (!isRecord(root)) {
        return failure(
            createFiberDiagnostic('fiber-root-unavailable', {
                context,
                details: { reason: 'root-not-object' },
                message: 'React Fiber root is not an object.',
                severity: 'error'
            })
        );
    }

    if (!('current' in root)) {
        return failure(
            createFiberDiagnostic('fiber-field-missing', {
                context,
                details: { field: 'current', target: 'FiberRoot' },
                message: 'React Fiber root is missing the current Fiber.',
                severity: 'error'
            })
        );
    }

    const current = validateReactFiber(root.current, context);

    if (!current.ok) {
        return current;
    }

    return {
        diagnostics: current.diagnostics,
        ok: true,
        value: root as unknown as ReactFiberRoot
    };
}

export function validateReactFiber(
    fiber: unknown,
    context: FiberGuardContext = {}
): FiberGuardResult<ReactFiber> {
    if (!isRecord(fiber)) {
        return failure(
            createFiberDiagnostic('react-internals-unavailable', {
                context,
                details: { reason: 'fiber-not-object' },
                message: 'React Fiber internals are not an object.',
                severity: 'error'
            })
        );
    }

    const missingField = REQUIRED_FIBER_FIELDS.find(
        (field) => !(field in fiber)
    );

    if (missingField) {
        return failure(
            createFiberDiagnostic('fiber-field-missing', {
                context,
                details: { field: missingField, target: 'Fiber' },
                message: `React Fiber is missing required field "${missingField}".`,
                severity: 'error'
            })
        );
    }

    if (typeof fiber.tag !== 'number') {
        return failure(
            createFiberDiagnostic('fiber-field-missing', {
                context,
                details: { expected: 'number', field: 'tag', target: 'Fiber' },
                message: 'React Fiber tag is missing or invalid.',
                severity: 'error'
            })
        );
    }

    if (!isKnownReactFiberTag(fiber.tag)) {
        return failure(
            createFiberDiagnostic('fiber-tag-unknown', {
                context,
                details: { tag: fiber.tag },
                message: `React Fiber tag ${fiber.tag} is not recognized.`,
                severity: 'warning'
            })
        );
    }

    return {
        diagnostics: [],
        ok: true,
        value: fiber as unknown as ReactFiber
    };
}

export function getReactFiberFromHostInstance(hostInstance: unknown): {
    fiber: null | ReactFiber;
    internalKey: null | string;
} {
    if (!isRecord(hostInstance)) {
        return { fiber: null, internalKey: null };
    }

    const fiberKey = findReactInternalKey(hostInstance, [
        '__reactFiber$',
        '__reactInternalInstance$',
        '__reactContainer$'
    ]);

    if (!fiberKey) {
        return { fiber: null, internalKey: null };
    }

    const fiber = hostInstance[fiberKey];
    return isRecord(fiber)
        ? { fiber: fiber as unknown as ReactFiber, internalKey: fiberKey }
        : { fiber: null, internalKey: fiberKey };
}

export function resolveReactFiberFromHostInstance(
    hostInstance: unknown,
    context: FiberGuardContext = {}
): ReactFiberHostLookupResult {
    const hostFiberLookup = getReactFiberFromHostInstance(hostInstance);
    const parentLookup =
        hostFiberLookup.fiber === null
            ? getReactFiberFromClosestHostParent(hostInstance)
            : { fiber: null, internalKey: null };
    const fiber = hostFiberLookup.fiber ?? parentLookup.fiber;
    const internalKey = hostFiberLookup.internalKey ?? parentLookup.internalKey;

    if (!fiber) {
        return {
            diagnostics: [
                createFiberDiagnostic('fiber-host-node-unavailable', {
                    context,
                    details: { reason: 'fiber-key-not-found' },
                    message: 'React Fiber was not found on the host node.',
                    severity: 'warning'
                })
            ],
            fiber: null,
            hostFiber: null,
            inspectedFiber: null,
            internalKey,
            rootFiber: null
        };
    }

    const validatedFiber = validateReactFiber(fiber, context);

    if (!validatedFiber.ok) {
        return {
            diagnostics: validatedFiber.diagnostics,
            fiber: null,
            hostFiber: fiber,
            inspectedFiber: null,
            internalKey,
            rootFiber: findReactRootBoundaryFiber(fiber)
        };
    }

    return {
        diagnostics: validatedFiber.diagnostics,
        fiber: validatedFiber.value,
        hostFiber: validatedFiber.value,
        inspectedFiber: findNearestInspectableOwnerFiber(validatedFiber.value),
        internalKey,
        rootFiber: findReactRootBoundaryFiber(validatedFiber.value)
    };
}

export function findNearestInspectableOwnerFiber(
    fiber: null | ReactFiber
): null | ReactFiber {
    let current = fiber;

    while (current) {
        if (isCompositeInspectableReactFiberTag(current.tag)) {
            return current;
        }

        if (current.tag === ReactFiberTag.HostRoot) {
            return current;
        }

        current = current.return;
    }

    return null;
}

export function findReactRootBoundaryFiber(
    fiber: null | ReactFiber
): null | ReactFiber {
    let current = fiber;
    let portalBoundary: null | ReactFiber = null;

    while (current) {
        if (current.tag === ReactFiberTag.HostPortal) {
            portalBoundary = current;
        }

        if (current.tag === ReactFiberTag.HostRoot) {
            return portalBoundary ?? current;
        }

        current = current.return;
    }

    return portalBoundary;
}

const REQUIRED_FIBER_FIELDS = [
    'alternate',
    'child',
    'elementType',
    'flags',
    'index',
    'key',
    'memoizedProps',
    'memoizedState',
    'mode',
    'pendingProps',
    'return',
    'sibling',
    'stateNode',
    'tag',
    'type'
] as const;

function failure(diagnostic: DetectionDiagnosticRecord): FiberGuardFailure {
    return {
        diagnostics: [diagnostic],
        ok: false
    };
}

function createFiberDiagnostic(
    code: DetectionDiagnosticRecord['code'],
    options: {
        context: FiberGuardContext;
        details?: Record<string, unknown>;
        message: string;
        severity: DetectionDiagnosticRecord['severity'];
    }
): DetectionDiagnosticRecord {
    return {
        code,
        details: options.details,
        id: [
            'fiber',
            code,
            options.context.targetId,
            options.context.rendererId,
            options.context.rootId,
            options.details?.field,
            options.details?.tag
        ]
            .filter((part) => part !== undefined && part !== null)
            .join(':'),
        message: options.message,
        rendererId: options.context.rendererId,
        rootId: options.context.rootId,
        severity: options.severity,
        targetId: options.context.targetId,
        timestamp: options.context.timestamp ?? Date.now()
    };
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

function getReactFiberFromClosestHostParent(hostInstance: unknown): {
    fiber: null | ReactFiber;
    internalKey: null | string;
} {
    const hostNode = isHostNode(hostInstance) ? hostInstance : null;
    let current = hostNode?.nodeType === 3 ? hostNode.parentNode : null;

    while (current) {
        const lookup = getReactFiberFromHostInstance(current);

        if (lookup.fiber) {
            return lookup;
        }

        current = current.parentNode ?? null;
    }

    return { fiber: null, internalKey: null };
}

function findReactInternalKey(
    value: Record<PropertyKey, unknown>,
    prefixes: string[]
): null | string {
    return (
        Object.getOwnPropertyNames(value).find((key) =>
            prefixes.some((prefix) => key.startsWith(prefix))
        ) ?? null
    );
}

function isHostNode(value: unknown): value is ReactFiberHostNode {
    return isRecord(value) && 'nodeType' in value;
}
