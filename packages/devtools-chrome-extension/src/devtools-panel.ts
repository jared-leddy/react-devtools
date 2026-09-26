import { mountDevToolsClient } from '@devtools/client';
import '@devtools/client/style.css';
import { createDevToolsCoreClient } from '@devtools/core';

interface ChromeDevToolsPanelLike {
    devtools?: {
        inspectedWindow?: {
            eval?: (
                expression: string,
                callback?: (result: unknown, exceptionInfo?: unknown) => void
            ) => void;
        };
    };
    runtime?: {
        getURL?: (path: string) => string;
    };
}

interface DevToolsPanelBootstrapResult {
    didInjectUserApp: boolean;
    didMountClient: boolean;
    didOpenRpcClient: boolean;
}

const USER_APP_SCRIPT_ID = '__react-devtools-user-app__';
const USER_APP_SCRIPT_PATH = 'user-app.js';

const bootstrapResult = bootstrapDevToolsPanel();

globalThis.dispatchEvent(
    new CustomEvent('__react_devtools_panel_ready__', {
        detail: {
            ...bootstrapResult,
            source: 'react-devtools-extension'
        }
    })
);

export function bootstrapDevToolsPanel(): DevToolsPanelBootstrapResult {
    const didInjectUserApp = injectUserAppIntoInspectedWindow();
    const didMountClient = mountPanelClient();

    createDevToolsCoreClient({ preset: 'extension' });

    return {
        didInjectUserApp,
        didMountClient,
        didOpenRpcClient: true
    };
}

function injectUserAppIntoInspectedWindow(): boolean {
    const chromeApi = getChromeApi();
    const evalInInspectedWindow = chromeApi?.devtools?.inspectedWindow?.eval;
    const getRuntimeUrl = chromeApi?.runtime?.getURL;

    if (!evalInInspectedWindow || !getRuntimeUrl) {
        return false;
    }

    const userAppScriptUrl = getRuntimeUrl(USER_APP_SCRIPT_PATH);

    evalInInspectedWindow.call(
        chromeApi.devtools?.inspectedWindow,
        createUserAppInjectionExpression(userAppScriptUrl)
    );

    return true;
}

function mountPanelClient(): boolean {
    const root = document.getElementById('root');

    if (!root) {
        return false;
    }

    mountDevToolsClient(root);

    return true;
}

function createUserAppInjectionExpression(userAppScriptUrl: string): string {
    return `(() => {
        const scriptId = ${JSON.stringify(USER_APP_SCRIPT_ID)};
        if (document.getElementById(scriptId)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.async = false;
        script.src = ${JSON.stringify(userAppScriptUrl)};
        (document.documentElement || document.head || document.body).appendChild(script);
    })();`;
}

function getChromeApi() {
    return (
        globalThis as typeof globalThis & { chrome?: ChromeDevToolsPanelLike }
    ).chrome;
}

export {
    USER_APP_SCRIPT_ID,
    USER_APP_SCRIPT_PATH,
    createUserAppInjectionExpression
};

export {};
