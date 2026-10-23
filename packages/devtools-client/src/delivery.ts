import { connectViteClientContext } from '@devtools/kit';
import { setClientRouteEnvironment } from './routing';
import { setClientRuntimeState } from './runtime';
import type { DevToolsSession } from '@devtools/core/browser';

export async function initializeStandaloneDelivery(
    session?: DevToolsSession
): Promise<void> {
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
            if (hot && session) await session.connect();
            // A Vite socket is not evidence that a React backend connected.
            setClientRuntimeState({
                connectionStatus:
                    hot && session?.getSnapshot().status === 'connected'
                        ? 'connected'
                        : 'disconnected'
            });
        } catch {
            setClientRuntimeState({ connectionStatus: 'disconnected' });
        }
    } catch {
        // Non-Vite hosts can reject the metadata request; keep their default mode.
    }
}
