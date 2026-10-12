import {
    mountDevToolsClient,
    setClientRouteEnvironment
} from '@devtools/client';
import '@devtools/client/style.css';
import { createDevToolsSession } from '@devtools/core/browser';

interface FirefoxDevToolsPanelLike {
    devtools?: {
        inspectedWindow?: {
            tabId?: number;
            eval?: (
                expression: string,
                callback?: (result: unknown, exceptionInfo?: unknown) => void
            ) => void;
        };
    };
    runtime?: {
        getURL?: (path: string) => string;
    };
    tabs?: {
        executeScript?: (
            tabId: number,
            details: {
                file: string;
            }
        ) => Promise<unknown> | void;
    };
}

interface DevToolsPanelBootstrapResult {
    didInjectProxy: boolean;
    didInjectUserApp: boolean;
    didMountClient: boolean;
    didOpenRpcClient: boolean;
}

const PROXY_SCRIPT_PATH = 'proxy.js';
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
    const didInjectProxy = false;
    const didInjectUserApp = injectUserAppIntoInspectedWindow();
    const didMountClient = mountPanelClient();

    return {
        didInjectProxy,
        didInjectUserApp,
        didMountClient,
        didOpenRpcClient: true
    };
}

function injectUserAppIntoInspectedWindow(): boolean {
    const extensionApi = getFirefoxPanelApi();
    const evalInInspectedWindow = extensionApi?.devtools?.inspectedWindow?.eval;
    const getRuntimeUrl = extensionApi?.runtime?.getURL;

    if (!evalInInspectedWindow || !getRuntimeUrl) {
        return false;
    }

    const userAppScriptUrl = getRuntimeUrl(USER_APP_SCRIPT_PATH);

    evalInInspectedWindow.call(
        extensionApi.devtools?.inspectedWindow,
        createUserAppInjectionExpression(userAppScriptUrl)
    );

    return true;
}

function mountPanelClient(): boolean {
    const root = document.getElementById('root');

    if (!root) {
        return false;
    }

    setClientRouteEnvironment({ transport: 'extension' });
    mountDevToolsClient(root, {
        session: createDevToolsSession({ preset: 'extension' })
    });

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

function getFirefoxPanelApi() {
    const target = globalThis as typeof globalThis & {
        browser?: FirefoxDevToolsPanelLike;
        chrome?: FirefoxDevToolsPanelLike;
    };

    return target.browser ?? target.chrome;
}

export {
    PROXY_SCRIPT_PATH,
    USER_APP_SCRIPT_ID,
    USER_APP_SCRIPT_PATH,
    createUserAppInjectionExpression
};

export {};
