import type {
    CustomInspectorNode,
    CustomInspectorOptions,
    InspectorState,
    SerializableValue
} from './inspector.js';

export type PluginSettingValue = string | number | boolean;

export interface PluginSettingChoice<
    Value extends PluginSettingValue = string
> {
    label: string;
    value: Value;
}

export type PluginSettingItem =
    | {
          defaultValue: boolean;
          description?: string;
          label: string;
          type: 'boolean';
      }
    | {
          component?: 'button-group' | 'select';
          defaultValue: number | string;
          description?: string;
          label: string;
          options: Array<PluginSettingChoice<number | string>>;
          type: 'choice';
      }
    | {
          defaultValue: string;
          description?: string;
          label: string;
          type: 'text';
      }
    | {
          defaultValue: number;
          description?: string;
          label: string;
          max?: number;
          min?: number;
          step?: number;
          type: 'number';
      };

export type PluginSettings = Record<string, PluginSettingItem>;

export interface PluginDescriptor<AppContext = unknown> {
    app?: AppContext;
    homepage?: string;
    id: string;
    label: string;
    logo?: string;
    packageName?: string;
    settings?: PluginSettings;
}

export interface PluginSetupContext<
    AppContext = unknown,
    StateCategory extends string = string,
    StateValue = unknown
> {
    app?: AppContext;
    descriptor: PluginDescriptor<AppContext>;
    on: {
        editInspectorState(
            inspectorId: string,
            handler: (
                payload: EditInspectorStateRequest
            ) => Promise<void> | void
        ): void;
        getInspectorState(
            inspectorId: string,
            handler: (
                payload: InspectorStateRequest
            ) =>
                | InspectorState<StateCategory, StateValue>
                | InspectorStateResponse<StateCategory, StateValue>
                | Promise<
                      | InspectorState<StateCategory, StateValue>
                      | InspectorStateResponse<StateCategory, StateValue>
                  >
        ): void;
        getInspectorTree(
            inspectorId: string,
            handler: (
                payload: InspectorTreeRequest
            ) =>
                | Array<CustomInspectorNode>
                | InspectorTreeResponse
                | Promise<Array<CustomInspectorNode> | InspectorTreeResponse>
        ): void;
    };
    addInspector(options: CustomInspectorOptions): void;
    addTimelineEvent(options: TimelineEventOptions): void;
    addTimelineLayer(options: TimelineLayerOptions): void;
    editInspectorState(payload: EditInspectorStateRequest): Promise<void>;
    getSettings(): Record<string, PluginSettingValue>;
    notify(message: string): void;
    registerInspector(options: CustomInspectorOptions): void;
    selectInspectorNode(inspectorId: string, nodeId: string): void;
    sendInspectorState(
        inspectorId: string,
        nodeId: string
    ): Promise<InspectorStateResponse<StateCategory, StateValue>>;
    sendInspectorTree(
        inspectorId: string,
        filter?: string
    ): Promise<InspectorTreeResponse>;
    setSettings(settings: Record<string, PluginSettingValue>): void;
    setInspectorState(
        inspectorId: string,
        nodeId: string,
        state: InspectorState<StateCategory, StateValue>
    ): void;
    now(): number;
}

export interface InspectorTreeRequest {
    filter?: string;
    inspectorId: string;
}

export interface InspectorTreeResponse<NodeMetadata = unknown> {
    inspectorId: string;
    rootNodes: Array<CustomInspectorNode<NodeMetadata>>;
}

export interface InspectorStateRequest {
    inspectorId: string;
    nodeId: string;
}

export interface InspectorStateResponse<
    StateCategory extends string = string,
    StateValue = SerializableValue | unknown
> {
    inspectorId: string;
    nodeId: string;
    state: InspectorState<StateCategory, StateValue>;
}

export interface EditInspectorStatePayload {
    newKey?: string | null;
    remove?: boolean;
    value?: unknown;
}

export interface EditInspectorStateRequest {
    inspectorId: string;
    nodeId: string;
    path: Array<number | string>;
    state: EditInspectorStatePayload;
    type?: string;
}

export interface TimelineLayerOptions {
    color?: number | string;
    id: string;
    label: string;
}

export interface TimelineEventOptions<Data = unknown> {
    data?: Data;
    groupId?: string;
    layerId: string;
    subtitle?: string;
    time?: number;
    title: string;
}

export interface PluginSettingsStorage {
    getItem(key: string): null | string;
    setItem(key: string, value: string): void;
}

export type PluginSetupFunction<
    AppContext = unknown,
    StateCategory extends string = string,
    StateValue = SerializableValue | unknown
> = (
    api: PluginSetupContext<AppContext, StateCategory, StateValue>
) => void | Promise<void>;

export interface DevToolsPlugin<
    AppContext = unknown,
    StateCategory extends string = string,
    StateValue = SerializableValue | unknown
> {
    descriptor: PluginDescriptor<AppContext>;
    setup: PluginSetupFunction<AppContext, StateCategory, StateValue>;
}
