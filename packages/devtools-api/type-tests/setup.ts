import {
    setupDevToolsPlugin,
    setupDevtoolsPlugin,
    type DevToolsPlugin,
    type PluginDescriptor,
    type PluginSetupContext,
    type PluginSetupFunction,
    type PluginSettings,
    type PluginSettingsStorage,
    type PluginSettingValue
} from '@devtools/api';
import {
    expectType,
    type Assert,
    type Equal,
    type IsAny
} from './assertions.js';

interface CounterApp {
    count: number;
    increment(): void;
}
const app: CounterApp = {
    count: 0,
    increment() {
        this.count += 1;
    }
};
const settings: PluginSettings = {
    enabled: { type: 'boolean', label: 'Enabled', defaultValue: true },
    name: { type: 'text', label: 'Name', defaultValue: 'Counter' },
    limit: {
        type: 'number',
        label: 'Limit',
        defaultValue: 10,
        min: 0,
        max: 100,
        step: 1
    },
    density: {
        type: 'choice',
        label: 'Density',
        defaultValue: 'compact',
        options: [{ label: 'Compact', value: 'compact' }]
    }
};
const descriptor: PluginDescriptor<CounterApp> = {
    id: 'counter',
    label: 'Counter',
    app,
    settings
};

setupDevToolsPlugin(descriptor, (api) => {
    expectType<CounterApp | undefined>(api.app);
    api.app?.increment();
    expectType<Record<string, PluginSettingValue>>(api.getSettings());
    api.setSettings({ enabled: true, limit: 20 });
    api.notify('Ready');
    expectType<number>(api.now());
    // @ts-expect-error Application context retains its declared shape.
    api.app?.missingMethod();
    // @ts-expect-error Settings do not accept object values.
    api.setSettings({ invalid: {} });
});

const setup: PluginSetupFunction<CounterApp> = async (api) => {
    expectType<PluginSetupContext<CounterApp>>(api);
    api.app?.increment();
};
const plugin: DevToolsPlugin<CounterApp> = { descriptor, setup };
expectType<void>(setupDevToolsPlugin(plugin.descriptor, plugin.setup));
expectType<void>(setupDevtoolsPlugin(plugin.descriptor, plugin.setup));
const storage: PluginSettingsStorage = {
    getItem: () => null,
    setItem: () => {}
};
setupDevToolsPlugin(descriptor, setup, { hasRoot: false, storage });
setupDevToolsPlugin({ id: 'minimal', label: 'Minimal' }, (api) => {
    expectType<unknown>(api.app);
    // @ts-expect-error Untyped application context must be narrowed.
    api.app.increment();
});

export type SetupReturnsVoid = Assert<
    Equal<ReturnType<typeof setupDevToolsPlugin>, void>
>;
export type ContextIsNotAny = Assert<
    Equal<IsAny<Parameters<PluginSetupFunction>[0]>, false>
>;

// @ts-expect-error Descriptor ID is required.
setupDevToolsPlugin({ label: 'Missing ID' }, () => {});
// @ts-expect-error Setup must be a function.
setupDevToolsPlugin(descriptor, {});
const invalidSettings: PluginSettings = {
    // @ts-expect-error Boolean settings require a boolean default.
    enabled: { type: 'boolean', label: 'Enabled', defaultValue: 'true' }
};
void invalidSettings;

// @ts-expect-error Plugin authors must not rely on internal context constructors.
import { createDevToolsContext } from '@devtools/api';
// @ts-expect-error The implementation class remains internal.
import { DevToolsPluginAPI } from '@devtools/api';
void createDevToolsContext;
void DevToolsPluginAPI;
