import { mountDevToolsClient } from './mount';
import { initializeStandaloneDelivery } from './delivery';
import { createDevToolsSession } from '@devtools/core/browser';

const root = document.getElementById('root');

if (root) {
    const preset = new URL(window.location.href).searchParams.get(
        '__devtools_session'
    );
    if (
        preset === 'iframe' ||
        preset === 'broadcast-channel' ||
        preset === 'vite'
    ) {
        const session = createDevToolsSession({ preset });
        const mount = () => mountDevToolsClient(root, { session });
        if (preset === 'vite')
            void initializeStandaloneDelivery(session).then(mount);
        else mount();
    } else {
        mountDevToolsClient(root);
        void initializeStandaloneDelivery();
    }
}
