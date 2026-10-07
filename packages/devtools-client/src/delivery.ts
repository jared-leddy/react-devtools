import { connectViteClientContext } from '@devtools/kit';
import { setClientRouteEnvironment } from './routing';
import { setClientRuntimeState } from './runtime';

export async function initializeStandaloneDelivery(): Promise<void> {
    try {
        const response = await fetch(window.location.href, { method: 'HEAD' });
        const base = response.headers.get('X-React-Devtools-Vite-Base');

        if (!response.ok || !base) {
            return;
        }

        setClientRuntimeState({ connectionStatus: 'waiting' });
        setClientRouteEnvironment({ transport: 'vite' });
        try {
            const hot = await connectViteClientContext({ base });
            setClientRuntimeState({
                connectionStatus: hot ? 'connected' : 'disconnected'
            });
        } catch {
            setClientRuntimeState({ connectionStatus: 'disconnected' });
        }
    } catch {
        // Non-Vite hosts can reject the metadata request; keep their default mode.
    }
}
