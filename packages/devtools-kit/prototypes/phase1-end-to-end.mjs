import {
    createDevToolsContext,
    createIframeClientChannel,
    createIframeServerChannel,
    createRpcClient,
    createRpcServer,
    registerDevToolsPluginContext,
    resetDevToolsPluginRegistry
} from '../dist/index.js';
import { setupDevToolsPlugin } from '../../devtools-api/dist/index.js';

const INSPECTOR_ID = 'phase1-inspector';
const NODE_ID = 'phase1-root';

const { child, iframe, parent } = createIframeWindowPair();
const context = createDevToolsContext();
const serverChannel = createIframeServerChannel({
    allowedOrigin: child.origin,
    iframe,
    targetOrigin: child.origin,
    window: parent
});
const clientChannel = createIframeClientChannel({
    allowedOrigin: parent.origin,
    targetOrigin: parent.origin,
    window: child
});
const observedInspectors = [];
let pluginApi;

context.hooks.hook('inspector:add', (payload) => {
    observedInspectors.push(payload.inspector);
});

registerDevToolsPluginContext({ context, hasRoot: false });
setupDevToolsPlugin(
    {
        id: 'phase1-verifier',
        label: 'Phase 1 Verifier'
    },
    (api) => {
        pluginApi = api;
        api.addInspector({
            icon: 'component',
            id: INSPECTOR_ID,
            label: 'Phase 1 Inspector'
        });
        api.on.getInspectorTree(INSPECTOR_ID, () => [
            {
                id: NODE_ID,
                label: 'Phase 1 Root',
                tags: [{ label: 'ready' }]
            }
        ]);
        api.on.getInspectorState(INSPECTOR_ID, ({ nodeId }) => ({
            details: [
                {
                    key: 'nodeId',
                    value: nodeId
                },
                {
                    key: 'transport',
                    value: 'iframe'
                }
            ]
        }));
    }
);

assert(!pluginApi, 'plugin setup ran before the root was available');
registerDevToolsPluginContext({ context, hasRoot: true });
assert(pluginApi, 'plugin setup did not run after the root became available');
assert(
    observedInspectors.some((inspector) => inspector.id === INSPECTOR_ID),
    'fake inspector was not registered'
);

createRpcServer(
    {
        async sendInspectorState(inspectorId, nodeId) {
            return pluginApi.sendInspectorState(inspectorId, nodeId);
        },
        async sendInspectorTree(inspectorId) {
            return pluginApi.sendInspectorTree(inspectorId);
        }
    },
    { channel: serverChannel }
);

const client = createRpcClient({}, { channel: clientChannel });
const tree = await client.sendInspectorTree(INSPECTOR_ID);
const state = await client.sendInspectorState(INSPECTOR_ID, NODE_ID);

assert(
    tree.rootNodes[0]?.id === NODE_ID,
    `expected root node "${NODE_ID}", received ${JSON.stringify(tree)}`
);
assert(
    state.state.details?.[0]?.value === NODE_ID,
    `expected state node id "${NODE_ID}", received ${JSON.stringify(state)}`
);
assert(
    state.state.details?.[1]?.value === 'iframe',
    `expected iframe transport state, received ${JSON.stringify(state)}`
);

console.log('Phase 1 iframe inspector tree:');
console.log(JSON.stringify(tree, null, 2));
console.log('Phase 1 iframe inspector state:');
console.log(JSON.stringify(state, null, 2));
console.log('Phase 1 end-to-end verification passed.');

resetDevToolsPluginRegistry();

function createIframeWindowPair() {
    const parentWindow = createMockWindow('https://parent.example');
    const childWindow = createMockWindow('https://child.example');

    parentWindow.postMessage = (data) => {
        parentWindow.receivedMessages.push(data);
        parentWindow.dispatchMessage({
            data,
            origin: childWindow.origin,
            source: childWindow
        });
    };
    childWindow.parent = parentWindow;
    childWindow.postMessage = (data) => {
        childWindow.receivedMessages.push(data);
        childWindow.dispatchMessage({
            data,
            origin: parentWindow.origin,
            source: parentWindow
        });
    };

    return {
        child: childWindow,
        iframe: { contentWindow: childWindow },
        parent: parentWindow
    };
}

function createMockWindow(origin) {
    const listeners = new Set();

    return {
        addEventListener(_type, listener) {
            listeners.add(listener);
        },
        dispatchMessage(event) {
            for (const listener of listeners) {
                listener(event);
            }
        },
        location: { origin },
        origin,
        parent: undefined,
        postMessage(data) {
            this.receivedMessages.push(data);
        },
        receivedMessages: [],
        removeEventListener(_type, listener) {
            listeners.delete(listener);
        }
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
