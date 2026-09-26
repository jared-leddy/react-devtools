interface ChromeDevToolsLike {
    devtools?: {
        inspectedWindow?: {
            eval?: (
                expression: string,
                callback: (result: unknown, exceptionInfo?: unknown) => void
            ) => void;
        };
        panels?: {
            create?: (
                title: string,
                iconPath: string,
                pagePath: string,
                callback?: () => void
            ) => void;
        };
    };
}

interface DevToolsPanelDetectionOptions {
    maxAttempts?: number;
    panelPage?: string;
    pollIntervalMs?: number;
    setTimeout?: (handler: () => void, delay: number) => unknown;
}

const DEVTOOLS_PANEL_DETECTION_EXPRESSION = `Boolean(
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ &&
        (
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers?.size > 0 ||
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces?.size > 0
        )
)`;
const DEFAULT_MAX_DETECTION_ATTEMPTS = 20;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEVTOOLS_PANEL_PAGE = 'devtools-panel.html';
const DEVTOOLS_PANEL_TITLE = 'React';

startDevToolsPanelDetection();

globalThis.dispatchEvent(
    new CustomEvent('__react_devtools_devtools_page_ready__', {
        detail: {
            source: 'react-devtools-extension'
        }
    })
);

export function startDevToolsPanelDetection(
    options: DevToolsPanelDetectionOptions = {}
) {
    const chromeApi = getChromeApi();
    const evalInInspectedWindow = chromeApi?.devtools?.inspectedWindow?.eval;
    const createPanel = chromeApi?.devtools?.panels?.create;

    if (!evalInInspectedWindow || !createPanel) {
        return;
    }

    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_DETECTION_ATTEMPTS;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const panelPage = options.panelPage ?? DEVTOOLS_PANEL_PAGE;
    const setDetectionTimeout = options.setTimeout ?? globalThis.setTimeout;
    let attempts = 0;
    let didCreatePanel = false;

    const poll = () => {
        if (didCreatePanel || attempts >= maxAttempts) {
            return;
        }

        attempts += 1;
        evalInInspectedWindow.call(
            chromeApi.devtools?.inspectedWindow,
            DEVTOOLS_PANEL_DETECTION_EXPRESSION,
            (result, exceptionInfo) => {
                if (didCreatePanel) {
                    return;
                }

                if (result === true && !exceptionInfo) {
                    didCreatePanel = true;
                    createPanel.call(
                        chromeApi.devtools?.panels,
                        DEVTOOLS_PANEL_TITLE,
                        '',
                        panelPage
                    );
                    return;
                }

                if (attempts < maxAttempts) {
                    setDetectionTimeout(poll, pollIntervalMs);
                }
            }
        );
    };

    poll();
}

function getChromeApi() {
    return (globalThis as typeof globalThis & { chrome?: ChromeDevToolsLike })
        .chrome;
}

export {
    DEFAULT_MAX_DETECTION_ATTEMPTS,
    DEFAULT_POLL_INTERVAL_MS,
    DEVTOOLS_PANEL_DETECTION_EXPRESSION,
    DEVTOOLS_PANEL_PAGE,
    DEVTOOLS_PANEL_TITLE
};
