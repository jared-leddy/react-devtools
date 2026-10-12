import {
    createDevToolsSession,
    type DevToolsSession
} from '@devtools/core/browser';
import {
    mountDevToolsClient,
    type MountDevToolsClientOptions
} from '@devtools/client';

declare const container: Element;
declare const borrowedSession: DevToolsSession;
const options: MountDevToolsClientOptions = {
    session: borrowedSession,
    strictMode: true
};
const mounted = mountDevToolsClient(container, options);
mounted.unmount();
mountDevToolsClient(container, {
    session: createDevToolsSession({
        preset: 'extension',
        clientId: 'native-panel'
    })
});
// @ts-expect-error An RPC object is not a lifecycle-managed session.
mountDevToolsClient(container, { session: { handshake: async () => ({}) } });
