export type SerializablePrimitive = string | number | boolean | null;

export type SerializableValue =
    | SerializablePrimitive
    | SerializableValue[]
    | { [key: string]: SerializableValue };

export interface InspectorNodeTag {
    backgroundColor?: number | string;
    label: string;
    textColor?: number | string;
    tooltip?: string;
}

export interface CustomInspectorNode<Metadata = unknown> {
    children?: Array<CustomInspectorNode<Metadata>>;
    file?: string;
    id: string;
    label: string;
    metadata?: Metadata;
    name?: string;
    tags?: InspectorNodeTag[];
}

export interface CustomInspectorAction {
    action: string;
    icon?: string;
    label?: string;
    tooltip?: string;
}

export interface CustomInspectorOptions {
    actions?: CustomInspectorAction[];
    icon?: string;
    id: string;
    label: string;
    noSelectionText?: string;
    nodeActions?: CustomInspectorAction[];
    stateFilterPlaceholder?: string;
    treeFilterPlaceholder?: string;
}

export type InspectorStateValue = SerializableValue | unknown;

export interface InspectorStateEntry<Value = InspectorStateValue> {
    editable?: boolean;
    key: string;
    value: Value;
}

export type InspectorState<
    Category extends string = string,
    Value = InspectorStateValue
> = Record<Category, Array<InspectorStateEntry<Value>>>;

export interface CustomInspectorPayload<
    NodeMetadata = unknown,
    StateCategory extends string = string,
    StateValue = InspectorStateValue
> {
    nodes: Array<CustomInspectorNode<NodeMetadata>>;
    options: CustomInspectorOptions;
    state?: InspectorState<StateCategory, StateValue>;
}
