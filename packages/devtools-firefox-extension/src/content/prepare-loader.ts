interface FirefoxContentRuntimeLike {
    runtime?: {
        getURL?: (path: string) => string;
    };
}

interface PrepareLoaderResult {
    didInjectDetector: boolean;
    didInjectPrepare: boolean;
}

const DETECTOR_SCRIPT_ID = '__react-devtools-firefox-detector__';
const DETECTOR_SCRIPT_PATH = 'detector.js';
const PREPARE_SCRIPT_ID = '__react-devtools-firefox-prepare__';
const PREPARE_SCRIPT_PATH = 'prepare.js';

const loaderResult = injectFirefoxPageScripts();

window.dispatchEvent(
    new CustomEvent('__react_devtools_prepare_loader_ready__', {
        detail: {
            ...loaderResult,
            source: 'react-devtools-extension'
        }
    })
);

export function injectFirefoxPageScripts(): PrepareLoaderResult {
    return {
        didInjectDetector: injectPageScript(
            DETECTOR_SCRIPT_ID,
            DETECTOR_SCRIPT_PATH
        ),
        didInjectPrepare: injectPageScript(
            PREPARE_SCRIPT_ID,
            PREPARE_SCRIPT_PATH
        )
    };
}

function injectPageScript(scriptId: string, scriptPath: string): boolean {
    if (document.getElementById(scriptId)) {
        return false;
    }

    const runtimeUrl = getExtensionRuntimeUrl(scriptPath);

    if (!runtimeUrl) {
        return false;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = false;
    script.src = runtimeUrl;
    (document.documentElement || document.head || document.body).appendChild(
        script
    );

    return true;
}

function getExtensionRuntimeUrl(path: string): string | null {
    const api = getFirefoxContentApi();

    return api?.runtime?.getURL?.(path) ?? null;
}

function getFirefoxContentApi() {
    const target = globalThis as typeof globalThis & {
        browser?: FirefoxContentRuntimeLike;
        chrome?: FirefoxContentRuntimeLike;
    };

    return target.browser ?? target.chrome;
}

export {
    DETECTOR_SCRIPT_ID,
    DETECTOR_SCRIPT_PATH,
    PREPARE_SCRIPT_ID,
    PREPARE_SCRIPT_PATH
};
