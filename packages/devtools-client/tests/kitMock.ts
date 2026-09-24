export enum ReactDevToolsContextHookKeys {
    ADD_INSPECTOR = 'inspector:add',
    CUSTOM_COMMAND_ADDED = 'custom-command:added',
    CUSTOM_COMMAND_REMOVED = 'custom-command:removed',
    CUSTOM_TAB_ADDED = 'custom-tab:added'
}

export interface CustomInspectorOptions {
    icon?: string;
    id: string;
    label: string;
}

export interface CustomTab {
    category?: string;
    icon?: string;
    name: string;
    path?: string;
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
        }
    });
}

export function resetDevToolsPluginRegistry(): void {
    activeContext = null;
    customCommands.clear();
    customTabs.clear();
    hooks[ReactDevToolsContextHookKeys.ADD_INSPECTOR] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED] = [];
}
