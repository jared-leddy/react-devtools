import { StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import type { DevToolsSession } from '@devtools/core/browser';
import { DevToolsSessionProvider } from './session';

export interface MountDevToolsClientOptions {
    children?: ReactNode;
    strictMode?: boolean;
    session?: DevToolsSession;
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
    const content = (
        <DevToolsSessionProvider session={options.session}>
            {children}
        </DevToolsSessionProvider>
    );
    void options.session?.connect();

    root.render(
        shouldUseStrictMode ? <StrictMode>{content}</StrictMode> : content
    );

    return {
        root,
        unmount: () => {
            root.unmount();
            options.session?.dispose();
        }
    };
}
