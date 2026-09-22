export enum ReactDevToolsContextHookKeys {
    ADD_INSPECTOR = 'inspector:add',
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

type HookPayloads = {
    [ReactDevToolsContextHookKeys.ADD_INSPECTOR]: {
        inspector: unknown;
        plugin: unknown;
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

const customTabs = new Map<string, CustomTab>();
const hooks: HookMap = {
    [ReactDevToolsContextHookKeys.ADD_INSPECTOR]: [],
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
    customTabs.clear();
    hooks[ReactDevToolsContextHookKeys.ADD_INSPECTOR] = [];
    hooks[ReactDevToolsContextHookKeys.CUSTOM_TAB_ADDED] = [];
}
