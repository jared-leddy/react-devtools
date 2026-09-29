export const createDevToolsContext = jest.fn(() => ({
    hooks: {
        callHook: jest.fn(),
        hook: jest.fn()
    }
}));

export const registerDevToolsPluginContext = jest.fn();
