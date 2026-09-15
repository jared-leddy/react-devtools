import type {
    PluginDescriptor,
    PluginSettingValue,
    PluginSettings,
    PluginSettingsStorage
} from '../../types/index.js';

export const PLUGIN_SETTINGS_STORAGE_PREFIX =
    '__react-devtools-plugin-settings__:';

const memorySettings = new Map<string, Record<string, PluginSettingValue>>();

export function getDefaultPluginSettings(
    settings: PluginSettings | undefined
): Record<string, PluginSettingValue> {
    return Object.fromEntries(
        Object.entries(settings ?? {}).map(([key, item]) => [
            key,
            item.defaultValue
        ])
    );
}

export function getPluginSettingsStorage(
    storage?: PluginSettingsStorage | null
): PluginSettingsStorage | null {
    if (storage !== undefined) {
        return storage;
    }

    const target = globalThis as typeof globalThis & {
        localStorage?: PluginSettingsStorage;
    };

    return target.localStorage ?? null;
}

export function getPluginSettingsKey(pluginId: string): string {
    return `${PLUGIN_SETTINGS_STORAGE_PREFIX}${pluginId}`;
}

export function readPluginSettings(
    descriptor: PluginDescriptor,
    storage?: PluginSettingsStorage | null
): Record<string, PluginSettingValue> {
    const defaults = getDefaultPluginSettings(descriptor.settings);
    const settingsStorage = getPluginSettingsStorage(storage);
    const storedValue = settingsStorage?.getItem(
        getPluginSettingsKey(descriptor.id)
    );

    if (storedValue) {
        try {
            return { ...defaults, ...JSON.parse(storedValue) };
        } catch {
            return defaults;
        }
    }

    return { ...defaults, ...(memorySettings.get(descriptor.id) ?? {}) };
}

export function writePluginSettings(
    descriptor: PluginDescriptor,
    settings: Record<string, PluginSettingValue>,
    storage?: PluginSettingsStorage | null
): void {
    const settingsStorage = getPluginSettingsStorage(storage);

    if (settingsStorage) {
        settingsStorage.setItem(
            getPluginSettingsKey(descriptor.id),
            JSON.stringify(settings)
        );
        return;
    }

    memorySettings.set(descriptor.id, settings);
}

export function initializePluginSettings(
    descriptor: PluginDescriptor,
    storage?: PluginSettingsStorage | null
): Record<string, PluginSettingValue> {
    const settings = readPluginSettings(descriptor, storage);

    writePluginSettings(descriptor, settings, storage);

    return settings;
}

export function clearPluginSettingsMemory(): void {
    memorySettings.clear();
}
