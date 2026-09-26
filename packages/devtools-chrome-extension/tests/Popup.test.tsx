import { fireEvent, render, screen } from '@testing-library/react';
import {
    Popup,
    createDefaultPopupStatus,
    getPopupViewModel,
    type PopupStatus
} from '../src';

function createStatus(overrides: Partial<PopupStatus> = {}): PopupStatus {
    return {
        ...createDefaultPopupStatus(),
        build: {
            channel: 'stable',
            version: '1.2.3'
        },
        docs: [
            { href: 'https://react.dev/tools', label: 'Docs' },
            {
                href: 'https://example.com/troubleshooting',
                label: 'Troubleshooting'
            }
        ],
        ...overrides
    };
}

describe('extension popup status UI', () => {
    it('explains that React was detected and the panel is available', () => {
        render(
            <Popup
                status={createStatus({
                    badge: 'ready',
                    inspectedUrl: 'https://app.example.test/',
                    panelAvailable: true,
                    reactStatus: 'detected'
                })}
            />
        );

        expect(
            screen.getByRole('main', {
                name: 'React DevTools extension popup'
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'React detected' })
        ).toBeInTheDocument();
        expect(
            screen.getByText('DevTools panel is available.')
        ).toBeInTheDocument();
        expect(screen.getByText('1.2.3 stable')).toBeInTheDocument();
        expect(
            screen.getByText('https://app.example.test/')
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText('Icon badge state: ready')
        ).toHaveAttribute('data-state', 'ready');
    });

    it('explains when React is missing', () => {
        render(
            <Popup
                status={createStatus({
                    badge: 'disabled',
                    reactStatus: 'not-detected'
                })}
            />
        );

        expect(
            screen.getByRole('heading', { name: 'React not detected' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'The DevTools panel is not available for this page.'
            )
        ).toBeInTheDocument();
        expect(screen.getByLabelText('React not found')).toHaveAttribute(
            'data-tone',
            'danger'
        );
    });

    it('renders unsupported version diagnostics', () => {
        render(
            <Popup
                status={createStatus({
                    badge: 'warning',
                    reactStatus: 'unsupported',
                    unsupportedVersion: {
                        currentVersion: '15.6.2',
                        minimumVersion: '16.8.0',
                        reason: 'Hooks inspection requires a newer renderer.'
                    }
                })}
            />
        );

        expect(
            screen.getByRole('heading', { name: 'Unsupported React version' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Detected React 15.6.2. Requires React 16.8.0 or newer. Hooks inspection requires a newer renderer.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('The DevTools panel is disabled for this page.')
        ).toBeInTheDocument();
    });

    it('shows unknown status while waiting for detector results', () => {
        const viewModel = getPopupViewModel(createDefaultPopupStatus());

        expect(viewModel.heading).toBe('Checking for React');
        expect(viewModel.badgeTone).toBe('info');
    });

    it('keeps a warning badge when React is detected with diagnostics', () => {
        const viewModel = getPopupViewModel(
            createStatus({
                badge: 'warning',
                panelAvailable: false,
                reactStatus: 'detected'
            })
        );

        expect(viewModel.badgeTone).toBe('warning');
        expect(viewModel.panelMessage).toBe(
            'Open browser DevTools to activate the React panel.'
        );
    });

    it('falls back when unsupported React diagnostics omit versions', () => {
        const viewModel = getPopupViewModel(
            createStatus({
                reactStatus: 'unsupported'
            })
        );

        expect(viewModel.description).toBe(
            'React was detected. The detected React version is not supported by this extension build.'
        );
    });

    it('invokes documentation link callbacks', () => {
        const onOpenDocs = jest.fn();
        render(<Popup onOpenDocs={onOpenDocs} status={createStatus()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Docs' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Troubleshooting' })
        );

        expect(onOpenDocs).toHaveBeenNthCalledWith(
            1,
            'https://react.dev/tools'
        );
        expect(onOpenDocs).toHaveBeenNthCalledWith(
            2,
            'https://example.com/troubleshooting'
        );
    });
});
