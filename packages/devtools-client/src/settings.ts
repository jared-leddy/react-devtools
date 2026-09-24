export type ClientThemePreference = 'dark' | 'light';
export type ClientPanelLayoutPreference = 'comfortable' | 'compact';

export interface ClientSettingsSnapshot {
    highPerformanceMode: boolean;
    panelLayout: ClientPanelLayoutPreference;
    reduceMotion: boolean;
    stateFilter: string;
    theme: ClientThemePreference;
    timelineRecording: boolean;
    treeFilter: string;
}

export interface ClientSettingsStorage {
    getItem(key: string): null | string;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}

type SettingsListener = () => void;

const SETTINGS_STORAGE_KEY = 'devtools.client.settings';
const listeners = new Set<SettingsListener>();
const memoryStorage = new Map<string, string>();

export const DEFAULT_CLIENT_SETTINGS: ClientSettingsSnapshot = {
    highPerformanceMode: false,
    panelLayout: 'comfortable',
    reduceMotion: false,
    stateFilter: '',
    theme: 'dark',
    timelineRecording: false,
    treeFilter: ''
};

let storageOverride: ClientSettingsStorage | null = null;
let currentSettings = readStoredSettings();

export function subscribeToClientSettings(
    listener: SettingsListener
): () => void {
    listeners.add(listener);
    installStorageSync();

    return () => {
        listeners.delete(listener);
    };
}

export function getClientSettingsSnapshot(): ClientSettingsSnapshot {
    return currentSettings;
}

export function setClientSetting<TKey extends keyof ClientSettingsSnapshot>(
    key: TKey,
    value: ClientSettingsSnapshot[TKey]
): void {
    updateClientSettings({ [key]: value } as Partial<ClientSettingsSnapshot>);
}

export function updateClientSettings(
    settings: Partial<ClientSettingsSnapshot>
): void {
    currentSettings = normalizeSettings({
        ...currentSettings,
        ...settings
    });
    writeStoredSettings(currentSettings);
    notifySettingsListeners();
}

export function resetClientSettings(): void {
    currentSettings = DEFAULT_CLIENT_SETTINGS;
    getSettingsStorage().removeItem(SETTINGS_STORAGE_KEY);
    notifySettingsListeners();
}

export function exportClientSettings(): string {
    return JSON.stringify(currentSettings, null, 2);
}

export function importClientSettings(serializedSettings: string): void {
    const parsedSettings = JSON.parse(serializedSettings) as unknown;

    if (!isPartialSettingsRecord(parsedSettings)) {
        throw new Error('Settings import must be a JSON object.');
    }

    currentSettings = normalizeSettings({
        ...DEFAULT_CLIENT_SETTINGS,
        ...parsedSettings
    });
    writeStoredSettings(currentSettings);
    notifySettingsListeners();
}

export function setClientSettingsStorageForTests(
    storage: ClientSettingsStorage | null
): void {
    storageOverride = storage;
    currentSettings = readStoredSettings();
    notifySettingsListeners();
}

export function resetClientSettingsForTests(): void {
    listeners.clear();
    storageOverride = null;
    getSettingsStorage().removeItem(SETTINGS_STORAGE_KEY);
    currentSettings = DEFAULT_CLIENT_SETTINGS;
}

function notifySettingsListeners(): void {
    listeners.forEach((listener) => listener());
}

function readStoredSettings(): ClientSettingsSnapshot {
    const rawSettings = getSettingsStorage().getItem(SETTINGS_STORAGE_KEY);

    if (!rawSettings) {
        return DEFAULT_CLIENT_SETTINGS;
    }

    try {
        const parsedSettings = JSON.parse(rawSettings) as unknown;

        return isPartialSettingsRecord(parsedSettings)
            ? normalizeSettings({
                  ...DEFAULT_CLIENT_SETTINGS,
                  ...parsedSettings
              })
            : DEFAULT_CLIENT_SETTINGS;
    } catch {
        return DEFAULT_CLIENT_SETTINGS;
    }
}

function writeStoredSettings(settings: ClientSettingsSnapshot): void {
    getSettingsStorage().setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
    );
}

function normalizeSettings(
    settings: Partial<ClientSettingsSnapshot>
): ClientSettingsSnapshot {
    return {
        highPerformanceMode: Boolean(settings.highPerformanceMode),
        panelLayout:
            settings.panelLayout === 'compact' ? 'compact' : 'comfortable',
        reduceMotion: Boolean(settings.reduceMotion),
        stateFilter:
            typeof settings.stateFilter === 'string'
                ? settings.stateFilter
                : '',
        theme: settings.theme === 'light' ? 'light' : 'dark',
        timelineRecording: Boolean(settings.timelineRecording),
        treeFilter:
            typeof settings.treeFilter === 'string' ? settings.treeFilter : ''
    };
}

function isPartialSettingsRecord(
    value: unknown
): value is Partial<ClientSettingsSnapshot> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getSettingsStorage(): ClientSettingsStorage {
    if (storageOverride) {
        return storageOverride;
    }

    if (
        typeof window !== 'undefined' &&
        isStorageAvailable(window.localStorage)
    ) {
        return window.localStorage;
    }

    return {
        getItem: (key) => memoryStorage.get(key) ?? null,
        removeItem: (key) => {
            memoryStorage.delete(key);
        },
        setItem: (key, value) => {
            memoryStorage.set(key, value);
        }
    };
}

function isStorageAvailable(storage: Storage): boolean {
    try {
        const key = 'devtools.client.storageProbe';
        storage.setItem(key, '1');
        storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

let storageSyncInstalled = false;

function installStorageSync(): void {
    if (storageSyncInstalled || typeof window === 'undefined') {
        return;
    }

    storageSyncInstalled = true;
    window.addEventListener('storage', (event) => {
        if (event.key !== SETTINGS_STORAGE_KEY) {
            return;
        }

        currentSettings = readStoredSettings();
        notifySettingsListeners();
    });
}
