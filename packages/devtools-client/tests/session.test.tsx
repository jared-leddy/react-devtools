import { act, screen } from '@testing-library/react';
import {
    mountDevToolsClient,
    useDevToolsSessionSnapshot,
    getSessionRuntimeSnapshot
} from '../src';
import type {
    DevToolsSession,
    DevToolsSessionSnapshot
} from '@devtools/core/browser';
import { createInitialDevToolsCoreState } from '../../devtools-core/src/state';

describe('host session provider', () => {
    it.each(['error', 'waiting', 'connecting', 'disconnected'] as const)(
        'does not show Connected or renderer facts for a %s host session',
        async (status) => {
            const snapshot = {
                sessionId: 'panel',
                status,
                ...(status === 'error' ? { error: 'Protocol mismatch' } : {})
            };
            const session: DevToolsSession = {
                getSnapshot: () => snapshot,
                subscribe: () => () => {},
                connect: async () => {},
                dispose: () => {}
            };
            const container = document.createElement('div');
            document.body.append(container);
            let mounted: ReturnType<typeof mountDevToolsClient>;
            await act(async () => {
                mounted = mountDevToolsClient(container, { session });
            });
            expect(screen.queryByText('Connected')).not.toBeInTheDocument();
            expect(screen.queryByText('18.3.1')).not.toBeInTheDocument();
            expect(container.textContent).toContain(
                status === 'error'
                    ? 'Protocol mismatch'
                    : 'No backend-confirmed snapshot'
            );
            act(() => {
                mounted.unmount();
            });
            container.remove();
        }
    );
    it.each([false, true])(
        'renders backend-confirmed overview records (complete metadata: %s)',
        async (complete) => {
            const state = createInitialDevToolsCoreState();
            state.renderers = [
                {
                    id: 8,
                    detectedAt: 1,
                    ...(complete
                        ? {
                              name: 'Real React renderer',
                              packageName: 'react-dom',
                              version: '19.1.1'
                          }
                        : {})
                }
            ];
            state.roots = [
                {
                    id: 'actual-app-root',
                    ...(complete
                        ? { label: 'Real application root', rendererId: 8 }
                        : {})
                }
            ];
            state.selectedComponentId = 'selected';
            const session: DevToolsSession = {
                getSnapshot: () => ({
                    sessionId: 'panel',
                    status: 'connected',
                    state
                }),
                subscribe: () => () => {},
                connect: async () => {},
                dispose: () => {}
            };
            // useSyncExternalStore requires a stable snapshot until an update arrives.
            const snapshot = session.getSnapshot();
            session.getSnapshot = () => snapshot;
            const container = document.createElement('div');
            document.body.append(container);
            let mounted: ReturnType<typeof mountDevToolsClient>;
            await act(async () => {
                mounted = mountDevToolsClient(container, { session });
            });
            expect(
                screen.getAllByText(
                    complete ? 'Real application root' : 'actual-app-root'
                ).length
            ).toBeGreaterThan(0);
            expect(container.textContent).toContain(
                complete ? '19.1.1' : 'Unknown'
            );
            expect(screen.queryByText('18.3.1')).not.toBeInTheDocument();
            act(() => {
                mounted.unmount();
            });
            container.remove();
        }
    );
    it('keeps one effective StrictMode subscription and disposes the host session on unmount', async () => {
        let snapshot: DevToolsSessionSnapshot = {
            sessionId: 'native-panel',
            status: 'connecting'
        };
        const listeners = new Set<() => void>();
        const session: DevToolsSession = {
            getSnapshot: () => snapshot,
            subscribe(listener) {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
            connect: jest.fn(async () => {}),
            dispose: jest.fn()
        };
        function Consumer() {
            return <output>{useDevToolsSessionSnapshot()?.status}</output>;
        }
        const container = document.createElement('div');
        document.body.append(container);
        let mounted: ReturnType<typeof mountDevToolsClient>;
        await act(async () => {
            mounted = mountDevToolsClient(container, {
                session,
                children: <Consumer />
            });
        });
        expect(listeners.size).toBe(1);
        expect(session.connect).toHaveBeenCalledTimes(1);
        act(() => {
            snapshot = { ...snapshot, status: 'error', error: 'Rejected' };
            listeners.forEach((listener) => listener());
        });
        expect(screen.getByText('error')).toBeInTheDocument();
        act(() => {
            mounted.unmount();
        });
        expect(listeners.size).toBe(0);
        expect(session.dispose).toHaveBeenCalledTimes(1);
        container.remove();
    });
    it.each([
        'waiting',
        'connecting',
        'connected',
        'error',
        'disconnected'
    ] as const)(
        'maps %s honestly without inventing renderers or roots',
        (status) => {
            expect(
                getSessionRuntimeSnapshot({ sessionId: 'test', status })
            ).toMatchObject({
                reactStatus: 'not-detected',
                rootStatus: 'empty',
                selectionStatus: 'none',
                connectionStatus:
                    status === 'connected'
                        ? 'connected'
                        : status === 'waiting' || status === 'connecting'
                          ? 'waiting'
                          : 'disconnected'
            });
        }
    );
});
