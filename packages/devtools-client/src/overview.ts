import type { ClientRuntimeSnapshot } from './runtime';
import type {
    ClientRouteEnvironment,
    ClientRouteRegistrySnapshot
} from './routing';
import type { ClientSettingsSnapshot } from './settings';

export interface ClientOverviewRenderer {
    id: string;
    name: string;
    reactVersion: string;
    rendererPackage: string;
    status: 'detected' | 'not-detected' | 'unsupported';
}

export interface ClientOverviewRoot {
    commitCount?: number;
    id: string;
    name: string;
    mountContainer: string;
    rendererId: string;
    isIframe: boolean;
    isPortal: boolean;
    status: 'empty' | 'ready';
}

export interface ClientOverviewIntegration {
    id: string;
    label: string;
    source: 'capability' | 'custom-inspector' | 'custom-tab' | 'transport';
}

export interface ClientOverviewDiagnostics {
    connectionStatus: ClientRuntimeSnapshot['connectionStatus'];
    deliveryMode: ClientRouteEnvironment['transport'];
    highPerformanceMode: boolean;
    lastCommitTime: string;
    timelineRecording: boolean;
    visibleRouteCount: number | null;
}

export interface ClientOverviewSnapshot {
    diagnostics: ClientOverviewDiagnostics;
    integrations: ClientOverviewIntegration[];
    renderers: ClientOverviewRenderer[];
    roots: ClientOverviewRoot[];
}

export function getClientOverviewSnapshot({
    routeSnapshot,
    runtimeSnapshot,
    settingsSnapshot
}: {
    routeSnapshot: ClientRouteRegistrySnapshot;
    runtimeSnapshot: ClientRuntimeSnapshot;
    settingsSnapshot: ClientSettingsSnapshot;
    visibleRouteCount: number;
}): ClientOverviewSnapshot {
    return {
        diagnostics: {
            connectionStatus: runtimeSnapshot.connectionStatus,
            deliveryMode: routeSnapshot.environment.transport,
            highPerformanceMode: settingsSnapshot.highPerformanceMode,
            lastCommitTime: 'Not available',
            timelineRecording: settingsSnapshot.timelineRecording,
            visibleRouteCount: null
        },
        integrations: getOverviewIntegrations(routeSnapshot),
        renderers: [],
        roots: []
    };
}

function getOverviewIntegrations(
    routeSnapshot: ClientRouteRegistrySnapshot
): ClientOverviewIntegration[] {
    const integrations: ClientOverviewIntegration[] = [
        {
            id: `transport:${routeSnapshot.environment.transport}`,
            label: formatTransportLabel(routeSnapshot.environment.transport),
            source: 'transport'
        },
        ...routeSnapshot.environment.capabilities.map((capability) => ({
            id: `capability:${capability}`,
            label: formatCapabilityLabel(capability),
            source: 'capability' as const
        })),
        ...routeSnapshot.customInspectors.map((inspector) => ({
            id: `custom-inspector:${inspector.id}`,
            label: inspector.label,
            source: 'custom-inspector' as const
        })),
        ...routeSnapshot.customTabs.map((tab) => ({
            id: `custom-tab:${tab.name}`,
            label: tab.title,
            source: 'custom-tab' as const
        }))
    ];

    return integrations.sort((left, right) =>
        left.label.localeCompare(right.label)
    );
}

function formatTransportLabel(
    transport: ClientRouteEnvironment['transport']
): string {
    const labels: Record<ClientRouteEnvironment['transport'], string> = {
        extension: 'Browser extension',
        iframe: 'Overlay iframe',
        standalone: 'Standalone client',
        vite: 'Vite middleware'
    };

    return labels[transport];
}

function formatCapabilityLabel(capability: string): string {
    const labels: Record<string, string> = {
        next: 'Next.js',
        'react-router': 'React Router',
        'source-inspector': 'Source Inspector',
        vite: 'Vite'
    };

    return labels[capability] ?? capability;
}
