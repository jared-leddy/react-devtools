import { mountDevToolsClient } from './mount';
import { initializeStandaloneDelivery } from './delivery';
import { createDevToolsSession } from '@devtools/core/browser';
import { createBroadcastChannelClientChannel } from '@devtools/kit';

const root = document.getElementById('root');

if (root) {
    const params = new URL(window.location.href).searchParams;
    const preset =
        params.get('__devtools_session') ??
        (window.parent !== window ? 'iframe' : 'broadcast-channel');
    if (
        preset === 'iframe' ||
        preset === 'broadcast-channel' ||
        preset === 'vite'
    ) {
        const session = createDevToolsSession(
            preset === 'broadcast-channel'
                ? {
                      channel: createBroadcastChannelClientChannel({
                          channelName:
                              params.get('__devtools_channel') ?? undefined
                      })
                  }
                : { preset }
        );
        const mount = () => {
            const mounted = mountDevToolsClient(root, { session });
            window.addEventListener('pagehide', () => mounted.unmount(), {
                once: true
            });
        };
        if (preset === 'vite')
            void initializeStandaloneDelivery(session).then(mount);
        else {
            mount();
            void initializeStandaloneDelivery(session);
        }
    } else {
        mountDevToolsClient(root);
    }
}
