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
    visibleRouteCount: number;
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
    settingsSnapshot,
    visibleRouteCount
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
            lastCommitTime:
                runtimeSnapshot.rootStatus === 'ready'
                    ? '12.4 ms'
                    : 'No commits recorded',
            timelineRecording: settingsSnapshot.timelineRecording,
            visibleRouteCount
        },
        integrations: getOverviewIntegrations(routeSnapshot),
        renderers: getOverviewRenderers(runtimeSnapshot),
        roots: getOverviewRoots(runtimeSnapshot, routeSnapshot.environment)
    };
}

function getOverviewRenderers(
    runtimeSnapshot: ClientRuntimeSnapshot
): ClientOverviewRenderer[] {
    if (runtimeSnapshot.reactStatus === 'not-detected') {
        return [];
    }

    const reactVersion =
        runtimeSnapshot.reactStatus === 'unsupported'
            ? (runtimeSnapshot.unsupportedReactVersion ?? 'Unsupported')
            : '18.3.1';

    return [
        {
            id: 'renderer:primary',
            name: 'Primary renderer',
            reactVersion,
            rendererPackage: 'react-dom',
            status: runtimeSnapshot.reactStatus
        }
    ];
}

function getOverviewRoots(
    runtimeSnapshot: ClientRuntimeSnapshot,
    environment: ClientRouteEnvironment
): ClientOverviewRoot[] {
    if (runtimeSnapshot.reactStatus !== 'detected') {
        return [];
    }

    return [
        {
            id: 'root:app',
            isIframe: environment.transport === 'iframe',
            isPortal: environment.capabilities.includes('next'),
            mountContainer: '#root',
            name: 'App root',
            rendererId: 'renderer:primary',
            status: runtimeSnapshot.rootStatus
        }
    ];
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
        nekuta: 'Nekuta',
        next: 'Next.js',
        'react-router': 'React Router',
        'source-inspector': 'Source Inspector',
        vite: 'Vite'
    };

    return labels[capability] ?? capability;
}
