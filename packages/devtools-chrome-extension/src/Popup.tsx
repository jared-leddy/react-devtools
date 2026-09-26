import { Button, ThemeProvider } from '@devtools/ui';
import '@devtools/ui/style.css';
import {
    getPopupViewModel,
    type PopupStatus,
    type PopupViewModel
} from './popupStatus';
import './style.css';

export interface PopupProps {
    onOpenDocs?: (href: string) => void;
    status: PopupStatus;
}

export function Popup({ onOpenDocs, status }: PopupProps) {
    const viewModel = getPopupViewModel(status);

    return (
        <ThemeProvider defaultTheme="dark">
            <main
                aria-label="React DevTools extension popup"
                className="dt-extension-popup"
            >
                <PopupHeader status={status} viewModel={viewModel} />
                <section className="dt-extension-popup__panel">
                    <div
                        aria-label={viewModel.badgeLabel}
                        className="dt-extension-popup__status-orb"
                        data-tone={viewModel.badgeTone}
                    />
                    <div>
                        <h1>{viewModel.heading}</h1>
                        <p>{viewModel.description}</p>
                    </div>
                </section>
                <dl className="dt-extension-popup__details">
                    <div>
                        <dt>Panel</dt>
                        <dd>{viewModel.panelMessage}</dd>
                    </div>
                    <div>
                        <dt>Badge</dt>
                        <dd>{viewModel.badgeLabel}</dd>
                    </div>
                    <div>
                        <dt>Extension</dt>
                        <dd>
                            {status.build.version} {status.build.channel}
                        </dd>
                    </div>
                    <div>
                        <dt>Tab</dt>
                        <dd>{status.inspectedUrl ?? 'Current active tab'}</dd>
                    </div>
                </dl>
                <nav
                    aria-label="Documentation"
                    className="dt-extension-popup__links"
                >
                    {status.docs.map((link) => (
                        <Button
                            key={link.href}
                            onClick={() => {
                                onOpenDocs?.(link.href);
                            }}
                            size="sm"
                            variant="secondary"
                        >
                            {link.label}
                        </Button>
                    ))}
                </nav>
            </main>
        </ThemeProvider>
    );
}

function PopupHeader({
    status,
    viewModel
}: {
    status: PopupStatus;
    viewModel: PopupViewModel;
}) {
    return (
        <header className="dt-extension-popup__header">
            <div>
                <span className="dt-extension-popup__eyebrow">
                    React DevTools
                </span>
                <strong>{viewModel.badgeLabel}</strong>
            </div>
            <span
                aria-label={`Icon badge state: ${status.badge}`}
                className="dt-extension-popup__badge"
                data-state={status.badge}
            >
                {status.badge}
            </span>
        </header>
    );
}
