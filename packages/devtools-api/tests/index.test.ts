import * as api from '../src/index.js';

describe('@devtools/api', () => {
    it('exports the public plugin helpers', () => {
        expect(api.setupDevToolsPlugin).toEqual(expect.any(Function));
        expect(api.setupDevtoolsPlugin).toEqual(expect.any(Function));
        expect(api.addCustomTab).toEqual(expect.any(Function));
        expect(api.addCustomCommand).toEqual(expect.any(Function));
        expect(api.removeCustomCommand).toEqual(expect.any(Function));
    });

    it('can call setupDevToolsPlugin through the public package', () => {
        const setup = jest.fn();

        expect(() => {
            api.setupDevToolsPlugin(
                { id: 'api-smoke', label: 'API Smoke' },
                setup
            );
        }).not.toThrow();
        expect(setup).not.toHaveBeenCalled();
    });
});
