export enum ReactDevToolsContextHookKeys {
    ADD_INSPECTOR = 'inspector:add',
    CUSTOM_COMMAND_ADDED = 'custom-command:added',
    CUSTOM_COMMAND_REMOVED = 'custom-command:removed',
    CUSTOM_TAB_ADDED = 'custom-tab:added'
}

export interface CustomInspectorOptions {
    actions?: Array<{ action: string; label?: string; tooltip?: string }>;
    icon?: string;
    id: string;
    label: string;
    noSelectionText?: string;
    nodeActions?: Array<{ action: string; label?: string; tooltip?: string }>;
    stateFilterPlaceholder?: string;
    treeFilterPlaceholder?: string;
}

export interface CustomInspectorNode {
    children?: CustomInspectorNode[];
    id: string;
    label: string;
    tags?: Array<{ label: string }>;
}

export type InspectorState = Record<
    string,
    Array<{ editable?: boolean; key: string; value: unknown }>
>;

export interface InspectorTreeResponse {
    inspectorId: string;
    rootNodes: CustomInspectorNode[];
}

export interface InspectorStateResponse {
    inspectorId: string;
    nodeId: string;
    state: InspectorState;
}

export interface EditInspectorStateRequest {
    inspectorId: string;
    nodeId: string;
    path: Array<number | string>;
    state: { value?: unknown };
    type?: string;
}

export interface CustomTab {
    category?: string;
    icon?: string;
    iframeUrl?: string;
    name: string;
    path?: string;
    persist?: boolean;
    sandbox?: string;
    title: string;
    view?: unknown;
}

export interface CustomCommand {
    action?: () => Promise<void> | void;
    children?: CustomCommand[];
    icon?: string;
    id: string;
    label: string;
    order?: number;
    route?: string;
    url?: string;
}

type HookPayloads = {
    [ReactDevToolsContextHookKeys.ADD_INSPECTOR]: {
        inspector: unknown;
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
};
type HookHandler<TKey extends ReactDevToolsContextHookKeys> = (
    payload: HookPayloads[TKey]
) => void;
type HookMap = {
    [TKey in ReactDevToolsContextHookKeys]: Array<HookHandler<TKey>>;
};

const customCommands = new Map<string, CustomCommand>();
const customTabs = new Map<string, CustomTab>();
const inspectorStateHandlers = new Map<
    string,
    (payload: { inspectorId: string; nodeId: string }) => InspectorState
>();
const inspectorTreeHandlers = new Map<
    string,
    (payload: { filter?: string; inspectorId: string }) => CustomInspectorNode[]
>();
const editInspectorStateHandlers = new Map<
    string,
    (payload: EditInspectorStateRequest) => Promise<void> | void
>();
const hooks: HookMap = {
    [ReactDevToolsContextHookKeys.ADD_INSPECTOR]: [],
    [ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED]: [],
    [ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED]: [],
    [ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED]: []
};
let activeContext: ReturnType<typeof createDevToolsContext> | null = null;

export function createDevToolsContext() {
    return {
        hooks: {
            hook<TKey extends ReactDevToolsContextHookKeys>(
                key: TKey,
                handler: HookHandler<TKey>
            ) {
                hooks[key].push(handler);
            },
            callHook<TKey extends ReactDevToolsContextHookKeys>(
                key: TKey,
                payload: HookPayloads[TKey]
            ) {
                hooks[key].forEach((handler) => handler(payload));
            }
        }
    };
}

export function registerDevToolsPluginContext({
    context
}: {
    context: ReturnType<typeof createDevToolsContext>;
}) {
    activeContext = context;
}

export function addCustomTab(tab: CustomTab): void {
    customTabs.set(tab.name, tab);
    activeContext?.hooks.callHook(
        ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED,
        {
            tab
        }
    );
}

export function addCustomCommand(command: CustomCommand): void {
    customCommands.set(command.id, command);
    activeContext?.hooks.callHook(
        ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED,
        {
            command
        }
    );
}

export function removeCustomCommand(commandId: string): void {
    customCommands.delete(commandId);
    activeContext?.hooks.callHook(
        ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED,
        {
            commandId
        }
    );
}

export function getCustomCommands(): CustomCommand[] {
    return Array.from(customCommands.values());
}

export function getCustomTabs(): CustomTab[] {
    return Array.from(customTabs.values());
}

export function setupDevToolsPlugin(
    descriptor: { id: string; label: string },
    setup: (api: {
        addInspector: (options: CustomInspectorOptions) => void;
        on: {
            editInspectorState: (
                inspectorId: string,
                handler: (payload: EditInspectorStateRequest) => void
            ) => void;
            getInspectorState: (
                inspectorId: string,
                handler: (payload: {
                    inspectorId: string;
                    nodeId: string;
                }) => InspectorState
            ) => void;
            getInspectorTree: (
                inspectorId: string,
                handler: (payload: {
                    filter?: string;
                    inspectorId: string;
                }) => CustomInspectorNode[]
            ) => void;
        };
    }) => void
): void {
    setup({
        addInspector: (inspector) => {
            activeContext?.hooks.callHook(
                ReactDevToolsContextHookKeys.ADD_INSPECTOR,
                {
                    inspector,
                    plugin: { descriptor }
                }
            );
        },
        on: {
            editInspectorState: (inspectorId, handler) => {
                editInspectorStateHandlers.set(inspectorId, handler);
            },
            getInspectorState: (inspectorId, handler) => {
                inspectorStateHandlers.set(inspectorId, handler);
            },
            getInspectorTree: (inspectorId, handler) => {
                inspectorTreeHandlers.set(inspectorId, handler);
            }
        }
    });
}

export async function sendCustomInspectorTree(
    inspectorId: string,
    filter?: string
): Promise<InspectorTreeResponse> {
    return {
        inspectorId,
        rootNodes:
            inspectorTreeHandlers.get(inspectorId)?.({ filter, inspectorId }) ??
            []
    };
}

export async function sendCustomInspectorState(
    inspectorId: string,
    nodeId: string
): Promise<InspectorStateResponse> {
    return {
        inspectorId,
        nodeId,
        state:
            inspectorStateHandlers.get(inspectorId)?.({
                inspectorId,
                nodeId
            }) ?? {}
    };
}

export async function editCustomInspectorState(
    payload: EditInspectorStateRequest
): Promise<void> {
    await editInspectorStateHandlers.get(payload.inspectorId)?.(payload);
}

export function resetDevToolsPluginRegistry(): void {
    activeContext = null;
    customCommands.clear();
    customTabs.clear();
    editInspectorStateHandlers.clear();
    inspectorStateHandlers.clear();
    inspectorTreeHandlers.clear();
    hooks[ReactDevToolsContextHookKeys.ADD_INSPECTOR] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED] = [];
}
