import {
    bridgeReactDevToolsHookToContext,
    createDevToolsContext,
    createDevToolsContextHooks,
    createDevToolsHook,
    ReactDevToolsContextHookKeys,
    type ReactDevToolsContextHookPayloads
} from '../src/index.js';

describe('React DevTools context hooks', () => {
    it('calls multiple handlers registered for the same context hook key', async () => {
        const hooks = createDevToolsContextHooks();
        const firstHandler = jest.fn();
        const secondHandler = jest.fn();
        const payload: ReactDevToolsContextHookPayloads[ReactDevToolsContextHookKeys.INSPECTOR_TREE_REQUEST] =
            {
                filter: 'button',
                inspectorId: 'components',
                requestId: 'request-1'
            };

        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_REQUEST,
            firstHandler
        );
        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_REQUEST,
            secondHandler
        );

        await hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_REQUEST,
            payload
        );

        expect(firstHandler).toHaveBeenCalledWith(payload);
        expect(secondHandler).toHaveBeenCalledWith(payload);
    });

    it('delivers subsequent calls to handlers registered after an earlier call', async () => {
        const hooks = createDevToolsContextHooks();
        const firstHandler = jest.fn();
        const lateHandler = jest.fn();
        const firstPayload: ReactDevToolsContextHookPayloads[ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST] =
            {
                inspectorId: 'components',
                nodeId: 'node-1',
                requestId: 'request-1'
            };
        const secondPayload: ReactDevToolsContextHookPayloads[ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST] =
            {
                inspectorId: 'components',
                nodeId: 'node-2',
                requestId: 'request-2'
            };

        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST,
            firstHandler
        );

        await hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST,
            firstPayload
        );

        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST,
            lateHandler
        );

        await hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_REQUEST,
            secondPayload
        );

        expect(firstHandler).toHaveBeenNthCalledWith(1, firstPayload);
        expect(firstHandler).toHaveBeenNthCalledWith(2, secondPayload);
        expect(lateHandler).toHaveBeenCalledTimes(1);
        expect(lateHandler).toHaveBeenCalledWith(secondPayload);
    });

    it('supports inspector responses and edit-state request payloads', async () => {
        const hooks = createDevToolsContextHooks();
        const treeResponseHandler = jest.fn();
        const stateResponseHandler = jest.fn();
        const editStateHandler = jest.fn();

        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_RESPONSE,
            treeResponseHandler
        );
        hooks.hook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE,
            stateResponseHandler
        );
        hooks.hook(
            ReactDevToolsContextHookKeys.EDIT_STATE_REQUEST,
            editStateHandler
        );

        await hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_TREE_RESPONSE,
            {
                inspectorId: 'components',
                requestId: 'request-1',
                rootNodes: [{ id: 'root', label: 'App' }]
            }
        );
        await hooks.callHook(
            ReactDevToolsContextHookKeys.INSPECTOR_STATE_RESPONSE,
            {
                inspectorId: 'components',
                nodeId: 'root',
                requestId: 'request-2',
                state: [{ data: { count: 1 }, id: 'hooks', label: 'Hooks' }]
            }
        );
        await hooks.callHook(ReactDevToolsContextHookKeys.EDIT_STATE_REQUEST, {
            inspectorId: 'components',
            nodeId: 'root',
            path: ['hooks', 0, 'value'],
            type: 'set',
            value: 2
        });

        expect(treeResponseHandler).toHaveBeenCalledWith({
            inspectorId: 'components',
            requestId: 'request-1',
            rootNodes: [{ id: 'root', label: 'App' }]
        });
        expect(stateResponseHandler).toHaveBeenCalledWith({
            inspectorId: 'components',
            nodeId: 'root',
            requestId: 'request-2',
            state: [{ data: { count: 1 }, id: 'hooks', label: 'Hooks' }]
        });
        expect(editStateHandler).toHaveBeenCalledWith({
            inspectorId: 'components',
            nodeId: 'root',
            path: ['hooks', 0, 'value'],
            type: 'set',
            value: 2
        });
    });

    it('bridges low-level hook commit events into context hook events', () => {
        const { hook } = createDevToolsHook({ target: {} });
        const context = createDevToolsContext({ hook });
        const commitHandler = jest.fn();
        const postCommitHandler = jest.fn();
        const unmountHandler = jest.fn();
        const root = { current: {} };
        const fiber = { tag: 'FunctionComponent' };

        context.hooks.hook(
            ReactDevToolsContextHookKeys.COMMIT_FIBER_ROOT,
            commitHandler
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.POST_COMMIT_FIBER_ROOT,
            postCommitHandler
        );
        context.hooks.hook(
            ReactDevToolsContextHookKeys.COMMIT_FIBER_UNMOUNT,
            unmountHandler
        );

        hook!.onCommitFiberRoot(1, root, 'normal-priority', false);
        hook!.onPostCommitFiberRoot(1, root);
        hook!.onCommitFiberUnmount(1, fiber);

        expect(commitHandler).toHaveBeenCalledWith({
            didError: false,
            priorityLevel: 'normal-priority',
            rendererID: 1,
            root
        });
        expect(postCommitHandler).toHaveBeenCalledWith({ rendererID: 1, root });
        expect(unmountHandler).toHaveBeenCalledWith({ fiber, rendererID: 1 });
    });

    it('can create an unbridged context and can unsubscribe a manual bridge', () => {
        const { hook } = createDevToolsHook({ target: {} });
        const unbridgedContext = createDevToolsContext({
            hook,
            shouldBridgeHookEvents: false
        });
        const bridgedHooks = createDevToolsContextHooks();
        const unbridgedHandler = jest.fn();
        const bridgedHandler = jest.fn();
        const root = { current: {} };
        const unsubscribe = bridgeReactDevToolsHookToContext(
            hook!,
            bridgedHooks
        );

        unbridgedContext.hooks.hook(
            ReactDevToolsContextHookKeys.COMMIT_FIBER_ROOT,
            unbridgedHandler
        );
        bridgedHooks.hook(
            ReactDevToolsContextHookKeys.COMMIT_FIBER_ROOT,
            bridgedHandler
        );

        hook!.onCommitFiberRoot(1, root);
        unsubscribe();
        hook!.onCommitFiberRoot(1, root);

        expect(unbridgedHandler).not.toHaveBeenCalled();
        expect(bridgedHandler).toHaveBeenCalledTimes(1);
        expect(bridgedHandler).toHaveBeenCalledWith({
            didError: undefined,
            priorityLevel: undefined,
            rendererID: 1,
            root
        });
    });
});
