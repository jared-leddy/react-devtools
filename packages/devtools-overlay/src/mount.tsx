import { createRoot } from 'react-dom/client';
import { DevtoolsOverlay, type DevtoolsOverlayProps } from './App';

const CONTAINER_ID = '__react-devtools-overlay__';
const CLIENT_URL_ATTRIBUTE = 'data-react-devtools-client-url';
const SEPARATE_WINDOW_URL_ATTRIBUTE = 'data-react-devtools-separate-window-url';

declare global {
    interface Window {
        __REACT_DEVTOOLS_OVERLAY_CONFIG__?: Pick<
            DevtoolsOverlayProps,
            'clientUrl' | 'separateWindowUrl'
        >;
    }
}

export function mountDevtoolsOverlay(
    targetDocument: Document = document,
    props: DevtoolsOverlayProps = {}
) {
    const existingContainer = targetDocument.getElementById(CONTAINER_ID);
    const container = existingContainer ?? targetDocument.createElement('div');

    if (!existingContainer) {
        container.id = CONTAINER_ID;
        container.setAttribute('data-react-devtools-overlay', 'true');
        targetDocument.body.appendChild(container);
    }

    const root = createRoot(container);
    root.render(
        <DevtoolsOverlay
            {...getOverlayRuntimeConfig(targetDocument)}
            {...props}
        />
    );

    return { container, root };
}

export function getOverlayRuntimeConfig(
    targetDocument: Document = document
): Pick<DevtoolsOverlayProps, 'clientUrl' | 'separateWindowUrl'> {
    const globalConfig = window.__REACT_DEVTOOLS_OVERLAY_CONFIG__;
    const scriptConfig = getOverlayScriptConfig(targetDocument);

    return {
        ...globalConfig,
        ...scriptConfig
    };
}

function getOverlayScriptConfig(
    targetDocument: Document
): Pick<DevtoolsOverlayProps, 'clientUrl' | 'separateWindowUrl'> {
    const script = targetDocument.querySelector<HTMLScriptElement>(
        `script[${CLIENT_URL_ATTRIBUTE}]`
    );

    if (!script) {
        return {};
    }

    const clientUrl = script.getAttribute(CLIENT_URL_ATTRIBUTE) ?? undefined;
    const separateWindowUrl =
        script.getAttribute(SEPARATE_WINDOW_URL_ATTRIBUTE) ?? clientUrl;

    return {
        clientUrl,
        separateWindowUrl
    };
}
