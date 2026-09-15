import type { Hookable } from 'hookable';
import { createHooks } from 'hookable';

import type {
    ReactDevToolsFiber,
    ReactDevToolsFiberRoot,
    ReactDevToolsGlobalHook,
    ReactDevToolsRendererID
} from '../hook/index.js';

export enum ReactDevToolsContextHookKeys {
    ADD_INSPECTOR = 'inspector:add',
    CUSTOM_COMMAND_ADDED = 'custom-command:added',
    CUSTOM_COMMAND_REMOVED = 'custom-command:removed',
    CUSTOM_TAB_ADDED = 'custom-tab:added',
    CUSTOM_INSPECTOR_SELECT_NODE = 'inspector:select-node',
    INSPECTOR_TREE_REQUEST = 'inspector-tree:request',
    INSPECTOR_TREE_RESPONSE = 'inspector-tree:response',
    INSPECTOR_STATE_REQUEST = 'inspector-state:request',
    INSPECTOR_STATE_RESPONSE = 'inspector-state:response',
    EDIT_STATE_REQUEST = 'state:edit-request',
    TIMELINE_LAYER_ADDED = 'timeline-layer:added',
    TIMELINE_EVENT_ADDED = 'timeline-event:added',
    COMMIT_FIBER_ROOT = 'react:commit-fiber-root',
    POST_COMMIT_FIBER_ROOT = 'react:post-commit-fiber-root',
    COMMIT_FIBER_UNMOUNT = 'react:commit-fiber-unmount'
}

export interface InspectorTreeNode {
    children?: InspectorTreeNode[];
    id: string;
    label: string;
    tags?: string[];
}

export interface ContextInspectorState {
    data: unknown;
    id: string;
    label?: string;
}

export interface EditStateRequest {
    inspectorId: string;
    nodeId: string;
    path: Array<string | number>;
    type?: string;
    value: unknown;
}

export interface ContextTimelineLayer {
    color?: number | string;
    id: string;
    label: string;
}

export interface ContextTimelineEvent {
    data?: unknown;
    groupId?: string;
    layerId: string;
    subtitle?: string;
    time?: number;
    title: string;
}

export interface ReactDevToolsContextHookPayloads {
    [ReactDevToolsContextHookKeys.ADD_INSPECTOR]: {
        inspector: unknown;
        plugin: unknown;
    };
    [ReactDevToolsContextHookKeys.CUSTOM_INSPECTOR_SELECT_NODE]: {
        inspectorId: string;
        nodeId: string;
        plugin: unknown;
    };
    [ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED]: {
        command: unknown;
    };
    [ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED]: {
        commandId: string;
    };
    [ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED]: {
        tab: unknown;
    };
    [ReactDevToolsContextHookKeys.INSPECTOR_TREE_REQUEST]: {
        filter?: string;
        inspectorId: string;
        requestId: string;
    };
    [ReactDevToolsContextHookKeys.INSPECTOR_TREE_RESPONSE]: {
        inspectorId: string;
        requestId: string;
        rootNodes: InspectorTreeNode[];
    };
    [ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST]: {
        inspectorId: string;
        nodeId: string;
        requestId: string;
    };
    [ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE]: {
        inspectorId: string;
        nodeId: string;
        requestId: string;
        state: ContextInspectorState[];
    };
    [ReactDevToolsContextHookKeys.EDIT_STATE_REQUEST]: EditStateRequest;
    [ReactDevToolsContextHookKeys.TIMELINE_LAYER_ADDED]: {
        layer: ContextTimelineLayer;
        plugin: unknown;
    };
    [ReactDevToolsContextHookKeys.TIMELINE_EVENT_ADDED]: {
        event: ContextTimelineEvent;
        plugin: unknown;
    };
    [ReactDevToolsContextHookKeys.COMMIT_FIBER_ROOT]: {
        didError?: boolean;
        priorityLevel?: unknown;
        rendererID: ReactDevToolsRendererID;
        root: ReactDevToolsFiberRoot;
    };
    [ReactDevToolsContextHookKeys.POST_COMMIT_FIBER_ROOT]: {
        rendererID: ReactDevToolsRendererID;
        root: ReactDevToolsFiberRoot;
    };
    [ReactDevToolsContextHookKeys.COMMIT_FIBER_UNMOUNT]: {
        fiber: ReactDevToolsFiber;
        rendererID: ReactDevToolsRendererID;
    };
}

export type ReactDevToolsContextHookHandlers = {
    [TKey in ReactDevToolsContextHookKeys]: (
        payload: ReactDevToolsContextHookPayloads[TKey]
    ) => void | Promise<void>;
};

export type ReactDevToolsContextHooks =
    Hookable<ReactDevToolsContextHookHandlers>;

export interface DevToolsContext {
    hooks: ReactDevToolsContextHooks;
}

export interface CreateDevToolsContextOptions {
    hook?: ReactDevToolsGlobalHook | null;
    shouldBridgeHookEvents?: boolean;
}

export function createDevToolsContextHooks(): ReactDevToolsContextHooks {
    return createHooks<ReactDevToolsContextHookHandlers>();
}

export function createDevToolsContext(
    options: CreateDevToolsContextOptions = {}
): DevToolsContext {
    const hooks = createDevToolsContextHooks();

    if (options.shouldBridgeHookEvents !== false && options.hook) {
        bridgeReactDevToolsHookToContext(options.hook, hooks);
    }

    return { hooks };
}

export function bridgeReactDevToolsHookToContext(
    hook: ReactDevToolsGlobalHook,
    hooks: ReactDevToolsContextHooks
): () => void {
    const unsubscribeCommitRoot = hook.sub('commit-fiber-root', (payload) => {
        void hooks.callHook(
            ReactDevToolsContextHookKeys.COMMIT_FIBER_ROOT,
            payload
        );
    });
    const unsubscribePostCommitRoot = hook.sub(
        'post-commit-fiber-root',
        (payload) => {
            void hooks.callHook(
                ReactDevToolsContextHookKeys.POST_COMMIT_FIBER_ROOT,
                payload
            );
        }
    );
    const unsubscribeCommitUnmount = hook.sub(
        'commit-fiber-unmount',
        (payload) => {
            void hooks.callHook(
                ReactDevToolsContextHookKeys.COMMIT_FIBER_UNMOUNT,
                payload
            );
        }
    );

    return () => {
        unsubscribeCommitRoot();
        unsubscribePostCommitRoot();
        unsubscribeCommitUnmount();
    };
}
