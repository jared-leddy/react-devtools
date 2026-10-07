import {
    setupDevToolsPlugin,
    setupDevtoolsPlugin,
    type CustomInspectorAction,
    type CustomInspectorNode,
    type CustomInspectorOptions,
    type CustomInspectorPayload,
    type EditInspectorStatePayload,
    type EditInspectorStateRequest,
    type InspectorNodeTag,
    type InspectorState,
    type InspectorStateEntry,
    type InspectorStateRequest,
    type InspectorStateResponse,
    type InspectorTreeRequest,
    type InspectorTreeResponse,
    type SerializableValue
} from '@devtools/api';
import {
    expectType,
    type Assert,
    type Equal,
    type IsAny
} from './assertions.js';

const tag: InspectorNodeTag = {
    label: 'store',
    backgroundColor: '#fff',
    textColor: 0
};
const action: CustomInspectorAction = { action: 'reset', label: 'Reset' };
const options: CustomInspectorOptions = {
    id: 'counter:state',
    label: 'Counter',
    actions: [action],
    nodeActions: [action]
};
const nodes: CustomInspectorNode<{ store: string }>[] = [
    {
        id: 'counter',
        label: 'Counter',
        metadata: { store: 'counter' },
        tags: [tag],
        children: []
    }
];
const entry: InspectorStateEntry<number> = {
    key: 'count',
    value: 0,
    editable: true
};
const state: InspectorState<'state', number> = { state: [entry] };
const wrongState: InspectorState<'state', string> = {
    state: [{ key: 'count', value: 'wrong' }]
};
const payload: CustomInspectorPayload<{ store: string }, 'state', number> = {
    options,
    nodes,
    state
};
const serializable: SerializableValue = {
    count: 0,
    selected: false,
    items: [null, 'value']
};
void payload;
void serializable;

setupDevToolsPlugin<unknown, 'state', number>(
    { id: 'counter', label: 'Counter' },
    async (api) => {
        api.addInspector(options);
        api.registerInspector(options);
        api.on.getInspectorTree(options.id, (request) => {
            expectType<InspectorTreeRequest>(request);
            expectType<string | undefined>(request.filter);
            return nodes;
        });
        api.on.getInspectorTree(options.id, async ({ inspectorId }) => ({
            inspectorId,
            rootNodes: nodes
        }));
        api.on.getInspectorState(options.id, (request) => {
            expectType<InspectorStateRequest>(request);
            return state;
        });
        api.on.getInspectorState(
            options.id,
            async ({ inspectorId, nodeId }) => ({ inspectorId, nodeId, state })
        );
        api.on.editInspectorState(options.id, async (request) => {
            expectType<EditInspectorStateRequest>(request);
            expectType<EditInspectorStatePayload>(request.state);
            expectType<unknown>(request.state.value);
        });
        api.setInspectorState(options.id, 'counter', state);
        api.selectInspectorNode(options.id, 'counter');
        expectType<InspectorTreeResponse>(
            await api.sendInspectorTree(options.id, 'count')
        );
        const response = await api.sendInspectorState(options.id, 'counter');
        expectType<InspectorStateResponse<'state', number>>(response);
        expectType<number>(response.state.state[0]!.value);
        await api.editInspectorState({
            inspectorId: options.id,
            nodeId: 'counter',
            path: ['state', 0, 'value'],
            state: { value: 1 }
        });
        // @ts-expect-error Inspector labels are required.
        api.addInspector({ id: 'missing-label' });
        // @ts-expect-error Tree handlers must return nodes or a tree response.
        api.on.getInspectorTree(options.id, () => 'invalid');
        // @ts-expect-error State handlers preserve the declared value type.
        api.on.getInspectorState(options.id, () => wrongState);
        // @ts-expect-error State category is constrained by the plugin signature.
        api.setInspectorState(options.id, 'counter', { other: [] });
        api.editInspectorState({
            inspectorId: options.id,
            nodeId: 'counter',
            // @ts-expect-error Edit paths must contain only string or number segments.
            path: [false],
            state: {}
        });
    }
);

export type MetadataIsPreserved = Assert<
    Equal<
        CustomInspectorNode<{ store: string }>['metadata'],
        { store: string } | undefined
    >
>;
setupDevtoolsPlugin<unknown, 'state', number>(
    { id: 'typed-alias', label: 'Typed Alias' },
    async (api) => {
        expectType<InspectorStateResponse<'state', number>>(
            await api.sendInspectorState(options.id, 'counter')
        );
    }
);
export type StateValueIsNotAny = Assert<
    Equal<IsAny<InspectorStateEntry<number>['value']>, false>
>;
// @ts-expect-error Serializable values exclude functions.
const invalidSerializable: SerializableValue = () => {};
void invalidSerializable;
