import type {
    ContextInspectorState,
    DevToolsContext,
    InspectorTreeNode
} from '../../ctx/index.js';
import { ReactDevToolsContextHookKeys } from '../../ctx/index.js';
import type {
    CustomInspectorNode,
    CustomInspectorOptions,
    DevToolsPlugin,
    EditInspectorStateRequest,
    InspectorState,
    InspectorStateEntry,
    InspectorStateRequest,
    InspectorStateResponse,
    InspectorTreeRequest,
    InspectorTreeResponse,
    PluginDescriptor,
    PluginSettingsStorage,
    PluginSetupFunction,
    PluginSettingValue,
    TimelineEventOptions,
    TimelineLayerOptions
} from '../../types/index.js';
import {
    clearPluginSettingsMemory,
    initializePluginSettings,
    readPluginSettings,
    writePluginSettings
} from './settings.js';

type MaybePromise<T> = Promise<T> | T;
type InspectorTreeHandler<NodeMetadata = unknown> = (
    payload: InspectorTreeRequest
) => MaybePromise<
    | Array<CustomInspectorNode<NodeMetadata>>
    | InspectorTreeResponse<NodeMetadata>
>;
type InspectorStateHandler = (
    payload: InspectorStateRequest
) => MaybePromise<InspectorState | InspectorStateResponse>;
type EditInspectorStateHandler = (
    payload: EditInspectorStateRequest
) => MaybePromise<void>;

export interface RegisterDevToolsPluginContextOptions {
    context: DevToolsContext;
    hasRoot?: boolean;
    storage?: PluginSettingsStorage | null;
}

export interface SetupDevToolsPluginOptions {
    context?: DevToolsContext | null;
    hasRoot?: boolean;
    storage?: PluginSettingsStorage | null;
}

interface BufferedPlugin {
    descriptor: PluginDescriptor;
    setupFn: PluginSetupFunction;
    storage?: PluginSettingsStorage | null;
}

const bufferedPlugins: BufferedPlugin[] = [];
const installedPlugins = new Map<string, DevToolsPlugin>();
let activeContext: DevToolsContext | null = null;
let activeStorage: PluginSettingsStorage | null | undefined;
let rootIsAvailable = false;

export class DevToolsPluginAPI {
    readonly descriptor: PluginDescriptor;
    readonly plugin: DevToolsPlugin;
    private readonly context: DevToolsContext;
    private readonly storage: PluginSettingsStorage | null | undefined;
    private readonly editInspectorStateHandlers = new Map<
        string,
        EditInspectorStateHandler
    >();
    private readonly inspectorStateHandlers = new Map<
        string,
        InspectorStateHandler
    >();
    private readonly inspectorTreeHandlers = new Map<
        string,
        InspectorTreeHandler
    >();
    private readonly inspectors = new Map<string, CustomInspectorOptions>();
    private readonly timelineLayers = new Map<string, TimelineLayerOptions>();
    private readonly timelineEvents: TimelineEventOptions[] = [];

    constructor({
        context,
        plugin,
        storage
    }: {
        context: DevToolsContext;
        plugin: DevToolsPlugin;
        storage?: PluginSettingsStorage | null;
    }) {
        this.context = context;
        this.descriptor = plugin.descriptor;
        this.plugin = plugin;
        this.storage = storage;
        initializePluginSettings(this.descriptor, this.storage);
    }

    get app(): unknown {
        return this.descriptor.app;
    }

    get on() {
        return {
            editInspectorState: (
                inspectorId: string,
                handler: EditInspectorStateHandler
            ) => {
                this.editInspectorStateHandlers.set(inspectorId, handler);
            },
            getInspectorState: (
                inspectorId: string,
                handler: InspectorStateHandler
            ) => {
                this.inspectorStateHandlers.set(inspectorId, handler);
            },
            getInspectorTree: (
                inspectorId: string,
                handler: InspectorTreeHandler
            ) => {
                this.inspectorTreeHandlers.set(inspectorId, handler);
            }
        };
    }

    addInspector(options: CustomInspectorOptions): void {
        this.inspectors.set(options.id, options);
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.ADD_INSPECTOR,
            {
                inspector: options,
                plugin: this.plugin
            }
        );
    }

    registerInspector(options: CustomInspectorOptions): void {
        this.addInspector(options);
    }

    async sendInspectorTree(
        inspectorId: string,
        filter?: string
    ): Promise<InspectorTreeResponse> {
        const handler = this.inspectorTreeHandlers.get(inspectorId);
        const result = (await handler?.({ filter, inspectorId })) ?? [];
        const response = Array.isArray(result)
            ? { inspectorId, rootNodes: result }
            : result;

        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_RESPONSE,
            {
                inspectorId,
                requestId: `plugin:${this.descriptor.id}:tree`,
                rootNodes: response.rootNodes.map(toContextInspectorTreeNode)
            }
        );

        return response;
    }

    async sendInspectorState(
        inspectorId: string,
        nodeId: string
    ): Promise<InspectorStateResponse> {
        const handler = this.inspectorStateHandlers.get(inspectorId);
        const result = await handler?.({ inspectorId, nodeId });
        const response = isInspectorStateResponse(result)
            ? result
            : { inspectorId, nodeId, state: result ?? {} };

        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE,
            {
                inspectorId,
                nodeId,
                requestId: `plugin:${this.descriptor.id}:state`,
                state: toContextInspectorState(response.state)
            }
        );

        return response;
    }

    setInspectorState(
        inspectorId: string,
        nodeId: string,
        state: InspectorState
    ): void {
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE,
            {
                inspectorId,
                nodeId,
                requestId: `plugin:${this.descriptor.id}:state`,
                state: toContextInspectorState(state)
            }
        );
    }

    async editInspectorState(
        payload: EditInspectorStateRequest
    ): Promise<void> {
        await this.editInspectorStateHandlers.get(payload.inspectorId)?.(
            payload
        );
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.EDIT_STATE_REQUEST,
            {
                inspectorId: payload.inspectorId,
                nodeId: payload.nodeId,
                path: payload.path,
                type: payload.type,
                value: payload.state
            }
        );
    }

    selectInspectorNode(inspectorId: string, nodeId: string): void {
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.CUSTOM_INSPECTOR_SELECT_NODE,
            {
                inspectorId,
                nodeId,
                plugin: this.plugin
            }
        );
    }

    addTimelineLayer(options: TimelineLayerOptions): void {
        this.timelineLayers.set(options.id, options);
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.TIMELINE_LAYER_ADDED,
            {
                layer: options,
                plugin: this.plugin
            }
        );
    }

    addTimelineEvent(options: TimelineEventOptions): void {
        this.timelineEvents.push(options);
        void this.context.hooks.callHook(
            ReactDevToolsContextHookKeys.TIMELINE_EVENT_ADDED,
            {
                event: { ...options, time: options.time ?? this.now() },
                plugin: this.plugin
            }
        );
    }

    now(): number {
        return Date.now();
    }

    getSettings(): Record<string, PluginSettingValue> {
        return readPluginSettings(this.descriptor, this.storage);
    }

    notify(_message: string): void {}

    setSettings(settings: Record<string, PluginSettingValue>): void {
        writePluginSettings(this.descriptor, settings, this.storage);
    }
}

export function setupDevToolsPlugin(
    descriptor: PluginDescriptor,
    setupFn: PluginSetupFunction,
    options: SetupDevToolsPluginOptions = {}
): void {
    const context = options.context ?? activeContext;
    const storage = options.storage ?? activeStorage;

    if (context && (options.hasRoot ?? rootIsAvailable)) {
        installPlugin({ descriptor, setupFn, storage }, context);
        return;
    }

    bufferedPlugins.push({ descriptor, setupFn, storage });
}

export function setupDevtoolsPlugin(
    descriptor: PluginDescriptor,
    setupFn: PluginSetupFunction,
    options: SetupDevToolsPluginOptions = {}
): void {
    setupDevToolsPlugin(descriptor, setupFn, options);
}

export function registerDevToolsPluginContext(
    options: RegisterDevToolsPluginContextOptions
): void {
    activeContext = options.context;
    activeStorage = options.storage;
    rootIsAvailable = options.hasRoot ?? true;

    if (!rootIsAvailable) {
        return;
    }

    flushBufferedPlugins();
}

export function markDevToolsRootAvailable(): void {
    rootIsAvailable = true;
    flushBufferedPlugins();
}

export function getRegisteredDevToolsPlugins(): DevToolsPlugin[] {
    return Array.from(installedPlugins.values());
}

export function resetDevToolsPluginRegistry(): void {
    activeContext = null;
    activeStorage = undefined;
    rootIsAvailable = false;
    bufferedPlugins.length = 0;
    installedPlugins.clear();
    clearPluginSettingsMemory();
}

function flushBufferedPlugins(): void {
    if (!activeContext || !rootIsAvailable) {
        return;
    }

    while (bufferedPlugins.length > 0) {
        installPlugin(bufferedPlugins.shift()!, activeContext);
    }
}

function installPlugin(plugin: BufferedPlugin, context: DevToolsContext): void {
    if (installedPlugins.has(plugin.descriptor.id)) {
        return;
    }

    const devtoolsPlugin: DevToolsPlugin = {
        descriptor: plugin.descriptor,
        setup: plugin.setupFn
    };
    const api = new DevToolsPluginAPI({
        context,
        plugin: devtoolsPlugin,
        storage: plugin.storage ?? activeStorage
    });

    installedPlugins.set(plugin.descriptor.id, devtoolsPlugin);
    void plugin.setupFn(api);
}

function isInspectorStateResponse(
    value: InspectorState | InspectorStateResponse | undefined
): value is InspectorStateResponse {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'inspectorId' in value &&
        'nodeId' in value &&
        'state' in value
    );
}

function toContextInspectorState(
    state: InspectorState
): ContextInspectorState[] {
    return Object.entries(state).flatMap(([id, entries]) =>
        entries.map((entry: InspectorStateEntry) => ({
            data: entry.value,
            id: entry.key,
            label: id
        }))
    );
}

function toContextInspectorTreeNode(
    node: CustomInspectorNode
): InspectorTreeNode {
    return {
        children: node.children?.map(toContextInspectorTreeNode),
        id: node.id,
        label: node.label,
        tags: node.tags?.map((tag) => tag.label)
    };
}

export * from './settings.js';
