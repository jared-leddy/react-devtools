import * as browserEntry from '../src/browser.js';
import * as nodeEntry from '../src/node.js';
import * as rootEntry from '../src/index.js';

describe('devtools-core public exports', () => {
    it('exposes browser-safe helpers', () => {
        expect(browserEntry.createDevToolsCoreClient).toEqual(
            expect.any(Function)
        );
        expect(browserEntry.createPresetCoreClient).toEqual(
            expect.any(Function)
        );
        expect(browserEntry.createDevToolsCoreStateStore).toEqual(
            expect.any(Function)
        );
    });

    it('exposes node/server helpers separately', () => {
        expect(nodeEntry.createDevToolsCoreServer).toEqual(
            expect.any(Function)
        );
        expect(nodeEntry.createDevToolsCoreServerFunctions).toEqual(
            expect.any(Function)
        );
        expect(nodeEntry.createPresetCoreServer).toEqual(expect.any(Function));
    });

    it('exposes the combined root entry point', () => {
        expect(rootEntry.DevToolsCoreRpcEvent.HANDSHAKE).toBe('core:handshake');
        expect(rootEntry.DevToolsCoreRpcEvent.RENDERERS_UPDATED).toBe(
            'renderers:updated'
        );
        expect(rootEntry.DevToolsCoreRpcEvent.ROOT_EVENT_RECORDED).toBe(
            'roots:event-recorded'
        );
        expect(
            rootEntry.DevToolsCoreRpcEvent.DETECTION_DIAGNOSTIC_REPORTED
        ).toBe('detection:diagnostic-reported');
        expect(rootEntry.DevToolsCoreRpcEvent.PERFORMANCE_MODE_TOGGLED).toBe(
            'performance:mode-toggled'
        );
        expect(
            rootEntry.DevToolsCoreRpcEvent.PERFORMANCE_SETTINGS_UPDATED
        ).toBe('performance:settings-updated');
        expect(
            rootEntry.DevToolsCoreRpcEvent.PERFORMANCE_REFRESH_THROTTLED
        ).toBe('performance:refresh-throttled');
        expect(rootEntry.createDevToolsCoreStateStore).toEqual(
            expect.any(Function)
        );
    });
});
