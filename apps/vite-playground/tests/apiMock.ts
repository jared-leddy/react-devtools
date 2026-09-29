export const setupDevToolsPlugin = jest.fn(
    (
        _descriptor: unknown,
        setup: (api: { registerRouterAdapter(adapter: unknown): void }) => void
    ) => {
        setup({
            registerRouterAdapter: jest.fn()
        });
    }
);
