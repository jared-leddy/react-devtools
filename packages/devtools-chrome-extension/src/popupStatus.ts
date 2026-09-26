export type ReactDetectionStatus =
    'detected' | 'not-detected' | 'unknown' | 'unsupported';

export type ExtensionBadgeState = 'disabled' | 'ready' | 'unknown' | 'warning';

export interface ReactVersionDiagnostic {
    currentVersion?: string;
    minimumVersion?: string;
    reason: string;
}

export interface ExtensionBuildInfo {
    channel: 'beta' | 'canary' | 'dev' | 'stable';
    version: string;
}

export interface PopupDocumentationLink {
    href: string;
    label: string;
}

export interface PopupStatus {
    badge: ExtensionBadgeState;
    build: ExtensionBuildInfo;
    docs: PopupDocumentationLink[];
    inspectedUrl?: string;
    panelAvailable: boolean;
    reactStatus: ReactDetectionStatus;
    unsupportedVersion?: ReactVersionDiagnostic;
}

export interface PopupViewModel {
    badgeLabel: string;
    badgeTone: 'danger' | 'info' | 'success' | 'warning';
    description: string;
    heading: string;
    panelMessage: string;
}

const DEFAULT_DOCS: PopupDocumentationLink[] = [
    {
        href: 'https://react.dev/learn/react-developer-tools',
        label: 'React DevTools docs'
    },
    {
        href: 'https://github.com/jared-leddy/react-devtools/issues',
        label: 'Troubleshooting'
    }
];

export function createDefaultPopupStatus(): PopupStatus {
    return {
        badge: 'unknown',
        build: {
            channel: 'dev',
            version: '0.0.0'
        },
        docs: DEFAULT_DOCS,
        panelAvailable: false,
        reactStatus: 'unknown'
    };
}

export function getPopupViewModel(status: PopupStatus): PopupViewModel {
    if (status.reactStatus === 'detected') {
        return {
            badgeLabel: 'React detected',
            badgeTone: status.badge === 'warning' ? 'warning' : 'success',
            description:
                'React is available on this page. Open the DevTools panel from the browser developer tools.',
            heading: 'React detected',
            panelMessage: status.panelAvailable
                ? 'DevTools panel is available.'
                : 'Open browser DevTools to activate the React panel.'
        };
    }

    if (status.reactStatus === 'unsupported') {
        const version = status.unsupportedVersion?.currentVersion;
        const minimum = status.unsupportedVersion?.minimumVersion;
        const reason =
            status.unsupportedVersion?.reason ??
            'The detected React version is not supported by this extension build.';

        return {
            badgeLabel: 'Unsupported React',
            badgeTone: 'warning',
            description: [
                version ? `Detected React ${version}.` : 'React was detected.',
                minimum ? `Requires React ${minimum} or newer.` : undefined,
                reason
            ]
                .filter(Boolean)
                .join(' '),
            heading: 'Unsupported React version',
            panelMessage: 'The DevTools panel is disabled for this page.'
        };
    }

    if (status.reactStatus === 'not-detected') {
        return {
            badgeLabel: 'React not found',
            badgeTone: 'danger',
            description:
                'No compatible React renderer was detected in the current tab.',
            heading: 'React not detected',
            panelMessage: 'The DevTools panel is not available for this page.'
        };
    }

    return {
        badgeLabel: 'Checking page',
        badgeTone: 'info',
        description:
            'The extension is waiting for a detection signal from the inspected tab.',
        heading: 'Checking for React',
        panelMessage: 'The DevTools panel will appear when React is detected.'
    };
}
