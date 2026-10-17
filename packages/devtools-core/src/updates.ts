import type { DevToolsCoreStateStore } from './state.js';
import type {
    DevToolsCoreState,
    DevToolsCoreStatePatch,
    DevToolsSessionRequest,
    DevToolsSessionRevision,
    DevToolsSessionStateSnapshot,
    DevToolsSessionUpdate
} from './types.js';

export interface DevToolsUpdatePublisherOptions {
    store: Pick<DevToolsCoreStateStore, 'getState' | 'subscribe'>;
    publish(update: DevToolsSessionUpdate): void | Promise<unknown>;
    projectState?: (state: DevToolsCoreState) => DevToolsCoreState;
    onActiveChange?: (active: boolean) => void;
    delayMs?: number;
}

export function createDevToolsUpdatePublisher(
    options: DevToolsUpdatePublisherOptions
) {
    if (
        options.delayMs !== undefined &&
        (!Number.isFinite(options.delayMs) || options.delayMs < 0)
    )
        throw new Error('Update delay must be a non-negative finite number');
    const project = options.projectState ?? ((state) => state);
    const sessions = new Map<string, number>();
    let streamId = globalThis.crypto.randomUUID();
    let revision = 0;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: DevToolsCoreStatePatch = {};
    const invalidated = new Set<string>();
    let previousValues = options.store.getState().componentState;
    let previousComponents = options.store.getState().components;

    const flush = () => {
        clearTimeout(timer);
        timer = undefined;
        if (disposed || !sessions.size) return;
        const targetRevision = revision;
        const targetStream = streamId;
        const state = project(options.store.getState());
        const patch = Object.fromEntries(
            Object.keys(pending).map((key) => [
                key,
                state[key as keyof DevToolsCoreState]
            ])
        ) as DevToolsCoreStatePatch;
        // Values are fetched on demand; commits invalidate caches rather than copying them.
        delete patch.componentState;
        pending = {};
        const invalidatedComponents = [...invalidated];
        invalidated.clear();
        for (const [sessionId, baseRevision] of [...sessions]) {
            if (
                disposed ||
                streamId !== targetStream ||
                sessions.get(sessionId) !== baseRevision
            )
                continue;
            if (baseRevision === targetRevision) continue;
            sessions.set(sessionId, targetRevision);
            try {
                void Promise.resolve(
                    options.publish({
                        sessionId,
                        streamId: targetStream,
                        baseRevision,
                        revision: targetRevision,
                        patch,
                        invalidatedComponents
                    })
                ).catch(() => {});
            } catch {
                /* Revision polling recovers failed delivery. */
            }
        }
    };
    const suspend = () => {
        const active = unsubscribe !== undefined;
        sessions.clear();
        clearTimeout(timer);
        timer = undefined;
        pending = {};
        invalidated.clear();
        unsubscribe?.();
        unsubscribe = undefined;
        previousValues = {};
        previousComponents = [];
        if (active) options.onActiveChange?.(false);
    };
    const snapshot = (sessionId: string): DevToolsSessionStateSnapshot => {
        sessions.set(sessionId, revision);
        return {
            sessionId,
            streamId,
            revision,
            state: project(options.store.getState())
        };
    };

    return {
        connect(sessionId: string) {
            if (disposed) throw new Error('Update publisher disposed');
            if (!sessionId) throw new Error('Session identity required');
            if (!sessions.size) {
                streamId = globalThis.crypto.randomUUID();
                revision = 0;
                sessions.set(sessionId, revision);
                previousValues = options.store.getState().componentState;
                previousComponents = options.store.getState().components;
                unsubscribe = options.store.subscribe((_state, patch) => {
                    revision += 1;
                    if (patch.components) {
                        for (const component of [
                            ...previousComponents,
                            ...patch.components
                        ])
                            invalidated.add(component.id);
                        previousComponents = patch.components;
                    }
                    if (patch.componentState) {
                        for (const id of new Set([
                            ...Object.keys(previousValues),
                            ...Object.keys(patch.componentState)
                        ])) {
                            if (previousValues[id] !== patch.componentState[id])
                                invalidated.add(id);
                        }
                        previousValues = patch.componentState;
                    }
                    pending = { ...pending, ...patch };
                    timer ??= setTimeout(flush, options.delayMs ?? 16);
                });
                try {
                    options.onActiveChange?.(true);
                } catch (error) {
                    suspend();
                    throw error;
                }
            }
            return snapshot(sessionId);
        },
        getSnapshot(request: DevToolsSessionRequest) {
            if (
                disposed ||
                request.streamId !== streamId ||
                !sessions.has(request.sessionId)
            )
                throw new Error('Session stream is no longer active');
            return snapshot(request.sessionId);
        },
        getRevision(request: DevToolsSessionRequest): DevToolsSessionRevision {
            if (
                disposed ||
                request.streamId !== streamId ||
                !sessions.has(request.sessionId)
            )
                throw new Error('Session stream is no longer active');
            return { ...request, revision };
        },
        disconnect(request: DevToolsSessionRequest) {
            if (request.streamId !== streamId) return;
            sessions.delete(request.sessionId);
            if (!sessions.size) suspend();
        },
        flush,
        suspend,
        dispose() {
            if (disposed) return;
            suspend();
            disposed = true;
        }
    };
}

export type DevToolsUpdatePublisher = ReturnType<
    typeof createDevToolsUpdatePublisher
>;
