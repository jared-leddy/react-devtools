import type {
    CustomCommand,
    CustomInspectorNode,
    CustomInspectorOptions,
    CustomTab,
    EditInspectorStateRequest,
    InspectorState,
    InspectorStateRequest,
    InspectorStateResponse,
    InspectorTreeRequest,
    InspectorTreeResponse,
    PluginDescriptor,
    PluginSetupContext,
    PluginSetupFunction,
    TimelineEventOptions,
    TimelineLayerOptions
} from '@devtools/kit';

type MaybePromise<T> = Promise<T> | T;

type InspectorTreeHandler = (
    payload: InspectorTreeRequest
) => MaybePromise<CustomInspectorNode[] | InspectorTreeResponse>;

type InspectorStateHandler = (
    payload: InspectorStateRequest
) => MaybePromise<InspectorState | InspectorStateResponse>;

type EditInspectorStateHandler = (
    payload: EditInspectorStateRequest
) => MaybePromise<void>;

function isInspectorStateResponse(
    result: InspectorState | InspectorStateResponse | undefined
): result is InspectorStateResponse {
    return (
        result !== undefined &&
        'inspectorId' in result &&
        'nodeId' in result &&
        'state' in result
    );
}

function isInspectorTreeResponse(
    result: CustomInspectorNode[] | InspectorTreeResponse | undefined
): result is InspectorTreeResponse {
    return (
        result !== undefined && !Array.isArray(result) && 'rootNodes' in result
    );
}

const customCommands = new Map<string, CustomCommand>();
const customInspectors = new Map<string, CustomInspectorOptions>();
const customTabs = new Map<string, CustomTab>();
const installedPlugins = new Map<string, PluginDescriptor>();
const inspectorApis = new Map<string, MockPluginAPI>();

export const createDevToolsContext = jest.fn(() => ({
    hooks: {
        callHook: jest.fn(),
        hook: jest.fn()
    }
}));

export const registerDevToolsPluginContext = jest.fn();

class MockPluginAPI {
    readonly descriptor: PluginDescriptor;
    readonly editInspectorStateHandlers = new Map<
        string,
        EditInspectorStateHandler
    >();
    readonly inspectorStateHandlers = new Map<string, InspectorStateHandler>();
    readonly inspectorTreeHandlers = new Map<string, InspectorTreeHandler>();
    readonly timelineEvents: TimelineEventOptions[] = [];
    readonly timelineLayers = new Map<string, TimelineLayerOptions>();

    constructor(descriptor: PluginDescriptor) {
        this.descriptor = descriptor;
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
        customInspectors.set(options.id, options);
        inspectorApis.set(options.id, this);
    }

    registerInspector(options: CustomInspectorOptions): void {
        this.addInspector(options);
    }

    addTimelineLayer(options: TimelineLayerOptions): void {
        this.timelineLayers.set(options.id, options);
    }

    addTimelineEvent(options: TimelineEventOptions): void {
        this.timelineEvents.push(options);
    }

    async editInspectorState(payload: EditInspectorStateRequest) {
        await this.editInspectorStateHandlers.get(payload.inspectorId)?.(
            payload
        );
    }

    getSettings() {
        return {};
    }

    notify() {
        return undefined;
    }

    now() {
        return Date.now();
    }

    registerRouterAdapter() {
        return undefined;
    }

    selectInspectorNode() {
        return undefined;
    }

    async sendInspectorState(
        inspectorId: string,
        nodeId: string
    ): Promise<InspectorStateResponse> {
        const result = await this.inspectorStateHandlers.get(inspectorId)?.({
            inspectorId,
            nodeId
        });

        if (isInspectorStateResponse(result)) {
            return result;
        }

        return {
            inspectorId,
            nodeId,
            state: result ?? {}
        };
    }

    async sendInspectorTree(
        inspectorId: string,
        filter?: string
    ): Promise<InspectorTreeResponse> {
        const result = await this.inspectorTreeHandlers.get(inspectorId)?.({
            filter,
            inspectorId
        });

        if (isInspectorTreeResponse(result)) {
            return result;
        }

        return {
            inspectorId,
            rootNodes: result ?? []
        };
    }

    setInspectorState() {
        return undefined;
    }

    setSettings() {
        return undefined;
    }
}

export function setupDevToolsPlugin(
    descriptor: PluginDescriptor,
    setupFn: PluginSetupFunction
) {
    if (installedPlugins.has(descriptor.id)) {
        return;
    }

    installedPlugins.set(descriptor.id, descriptor);
    const api = new MockPluginAPI(descriptor);
    void setupFn(api as unknown as PluginSetupContext);
}

export const setupDevtoolsPlugin = setupDevToolsPlugin;

export function addCustomCommand(command: CustomCommand) {
    if (!customCommands.has(command.id)) {
        customCommands.set(command.id, command);
    }
}

export function addCustomTab(tab: CustomTab) {
    if (!customTabs.has(tab.name)) {
        customTabs.set(tab.name, tab);
    }
}

export function getCustomCommands() {
    return Array.from(customCommands.values());
}

export function getCustomInspectors() {
    return Array.from(customInspectors.values());
}

export function getCustomTabs() {
    return Array.from(customTabs.values());
}

export async function sendCustomInspectorTree(
    inspectorId: string,
    filter?: string
) {
    return (
        (await inspectorApis
            .get(inspectorId)
            ?.sendInspectorTree(inspectorId, filter)) ?? {
            inspectorId,
            rootNodes: []
        }
    );
}

export async function sendCustomInspectorState(
    inspectorId: string,
    nodeId: string
) {
    return (
        (await inspectorApis
            .get(inspectorId)
            ?.sendInspectorState(inspectorId, nodeId)) ?? {
            inspectorId,
            nodeId,
            state: {}
        }
    );
}

export async function editCustomInspectorState(
    payload: EditInspectorStateRequest
) {
    await inspectorApis.get(payload.inspectorId)?.editInspectorState(payload);
}
