import { StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';

export interface MountDevToolsClientOptions {
    children?: ReactNode;
    strictMode?: boolean;
}

export interface MountedDevToolsClient {
    root: Root;
    unmount: () => void;
}

export function mountDevToolsClient(
    container: Element | DocumentFragment,
    options: MountDevToolsClientOptions = {}
): MountedDevToolsClient {
    const root = createRoot(container);
    const children = options.children ?? <App />;
    const shouldUseStrictMode = options.strictMode ?? true;

    root.render(
        shouldUseStrictMode ? <StrictMode>{children}</StrictMode> : children
    );

    return {
        root,
        unmount: () => {
            root.unmount();
        }
    };
}
