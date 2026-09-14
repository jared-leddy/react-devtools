import type {
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
    getSettings(): Record<string, PluginSettingValue>;
    notify(message: string): void;
    registerInspector(options: CustomInspectorOptions): void;
    setInspectorState(
        inspectorId: string,
        nodeId: string,
        state: InspectorState<StateCategory, StateValue>
    ): void;
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
