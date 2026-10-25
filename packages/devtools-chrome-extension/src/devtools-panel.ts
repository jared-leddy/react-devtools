import {
    mountDevToolsClient,
    setClientRouteEnvironment
} from '@devtools/client';
import '@devtools/client/style.css';
import { createDevToolsSession } from '@devtools/core/browser';

interface ChromeDevToolsPanelLike {
    devtools?: {
        network?: {
            onNavigated?: {
                addListener?: (listener: () => void) => void;
                removeListener?: (listener: () => void) => void;
            };
        };
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
    scripting?: {
        executeScript?: (details: {
            files: string[];
            target: {
                tabId: number;
            };
        }) => void;
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
const navigationListener = () => {
    injectUserAppIntoInspectedWindow();
};
const navigationApi = getChromeApi()?.devtools?.network?.onNavigated;
navigationApi?.addListener?.(navigationListener);
globalThis.addEventListener(
    'unload',
    () => navigationApi?.removeListener?.(navigationListener),
    { once: true }
);

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

    setClientRouteEnvironment({ transport: 'extension' });
    const mounted = mountDevToolsClient(root, {
        session: createDevToolsSession({ preset: 'extension' })
    });
    globalThis.addEventListener('unload', () => mounted.unmount(), {
        once: true
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

function getChromeApi() {
    return (
        globalThis as typeof globalThis & { chrome?: ChromeDevToolsPanelLike }
    ).chrome;
}

export {
    PROXY_SCRIPT_PATH,
    USER_APP_SCRIPT_ID,
    USER_APP_SCRIPT_PATH,
    createUserAppInjectionExpression
};

export {};
