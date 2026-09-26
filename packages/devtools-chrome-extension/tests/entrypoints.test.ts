describe('extension entrypoints', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    it('registers service worker lifecycle listeners', async () => {
        const addEventListener = jest.spyOn(self, 'addEventListener');

        await import('../src/background');

        expect(addEventListener).toHaveBeenCalledWith(
            'install',
            expect.any(Function)
        );
        expect(addEventListener).toHaveBeenCalledWith(
            'activate',
            expect.any(Function)
        );

        for (const [, listener] of addEventListener.mock.calls) {
            if (typeof listener === 'function') {
                listener(new Event('test'));
            }
        }
    });

    it('announces the MAIN-world prepare script readiness', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_prepare_ready__', onReady);

        await import('../src/content/prepare');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('announces the isolated-world proxy script readiness', async () => {
        const onReady = jest.fn();
        window.addEventListener('__react_devtools_proxy_ready__', onReady);

        await import('../src/content/proxy');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });

    it('announces the DevTools page bootstrap readiness', async () => {
        const onReady = jest.fn();
        globalThis.addEventListener(
            '__react_devtools_devtools_page_ready__',
            onReady
        );

        await import('../src/devtools');

        expect(onReady).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: {
                    source: 'react-devtools-extension'
                }
            })
        );
    });
});
