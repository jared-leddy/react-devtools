import {
    act,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { App } from '../src/App';
import { DevToolsSessionProvider } from '../src/session';
import {
    createSessionComponentTree,
    filterComponentTree
} from '../src/components/model';
import { createInitialDevToolsCoreState } from '../../devtools-core/src/state';
import type {
    DevToolsSession,
    DevToolsSessionSnapshot
} from '@devtools/core/browser';

function fixture() {
    const child = {
        id: 'child',
        rootId: 'root',
        displayName: 'Counter',
        type: 'function'
    };
    let snapshot: DevToolsSessionSnapshot = {
        sessionId: 'real-host',
        streamId: 'stream',
        revision: 0,
        status: 'connected',
        capabilities: {
            roots: true,
            components: true,
            componentState: true,
            edit: false,
            stores: false,
            highlight: false,
            inspect: false
        },
        state: {
            ...createInitialDevToolsCoreState(),
            transportStatus: 'connected',
            renderers: [{ id: 1, version: '19.1.1' }],
            roots: [{ id: 'root', rendererId: 1 }],
            components: [
                {
                    id: 'app',
                    rootId: 'root',
                    displayName: 'RealApp',
                    children: [child]
                },
                child
            ]
        }
    };
    const listeners = new Set<() => void>();
    const inspect = jest.fn(
        async ({
            componentId,
            rootId
        }: {
            componentId: string;
            rootId: string;
        }) => ({
            componentId,
            rootId,
            sections: [
                {
                    name: 'props',
                    fields: [
                        {
                            name: 'message',
                            value:
                                componentId === 'child'
                                    ? 'Actual counter value'
                                    : 'Actual app value'
                        }
                    ]
                }
            ]
        })
    );
    const session: DevToolsSession = {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        connect: async () => {},
        dispose: () => {},
        inspectComponent: inspect
    };
    return {
        session,
        inspect,
        get snapshot() {
            return snapshot;
        },
        update(next: Partial<DevToolsSessionSnapshot>) {
            snapshot = { ...snapshot, ...next };
            listeners.forEach((listener) => listener());
        }
    };
}

describe('session-backed component model', () => {
    it('filters observed names without losing their ancestors or making up rows', () => {
        const nodes = createSessionComponentTree(
            fixture().snapshot.state!.components
        );
        expect(filterComponentTree(nodes, '')).toBe(nodes);
        expect(filterComponentTree(nodes, 'RealApp')).toEqual(nodes);
        expect(
            filterComponentTree(nodes, 'COUNTER')[0].children?.[0].label
        ).toBe('Counter');
        expect(filterComponentTree(nodes, 'absent')).toEqual([]);
    });
    it('does not substitute another component for an invalid requested identity', () => {
        const f = fixture();
        render(
            <DevToolsSessionProvider session={f.session}>
                <App
                    initialEntries={['/components?componentId=annotation-only']}
                />
            </DevToolsSessionProvider>
        );
        expect(screen.getByText('No component selected')).toBeInTheDocument();
        expect(f.inspect).not.toHaveBeenCalled();
    });
    it('renders an unsupported runtime diagnostic instead of guessing a tree', () => {
        const f = fixture();
        f.update({
            state: {
                ...f.snapshot.state!,
                diagnostics: [
                    {
                        id: 'unsupported',
                        code: 'renderer-version-unsupported',
                        message: 'Unsupported renderer',
                        timestamp: 1,
                        severity: 'warning'
                    }
                ]
            }
        });
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/components']} />
            </DevToolsSessionProvider>
        );
        expect(
            screen.getByRole('heading', { name: 'Unsupported React version' })
        ).toBeInTheDocument();
        expect(f.inspect).not.toHaveBeenCalled();
    });
    it('deduplicates flattened children and retains backend identities and names', () => {
        const f = fixture();
        expect(
            createSessionComponentTree(f.snapshot.state!.components)
        ).toEqual([
            {
                id: 'app',
                rootId: 'root',
                label: 'RealApp',
                children: [
                    {
                        id: 'child',
                        rootId: 'root',
                        label: 'Counter',
                        type: 'function'
                    }
                ]
            }
        ]);
        expect(createSessionComponentTree([])).toEqual([]);
    });
    it('renders real names and fetches only the selected component values', async () => {
        const f = fixture();
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/components']} />
            </DevToolsSessionProvider>
        );
        expect(await screen.findByText(/Actual app value/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Counter').closest('button')!);
        expect(
            await screen.findByText(/Actual counter value/)
        ).toBeInTheDocument();
        expect(f.inspect).toHaveBeenLastCalledWith({
            componentId: 'child',
            rootId: 'root'
        });
        expect(
            screen.queryByText(/ComponentGroup|ComponentLeaf/)
        ).not.toBeInTheDocument();
        act(() => f.update({ revision: 1 }));
        await waitFor(() => expect(f.inspect).toHaveBeenCalledTimes(3));
    });
    it('does not apply a late inspection after selecting another component', async () => {
        const f = fixture();
        let resolve!: (value: Awaited<ReturnType<typeof f.inspect>>) => void;
        f.inspect.mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/components']} />
            </DevToolsSessionProvider>
        );
        fireEvent.click(screen.getByText('Counter').closest('button')!);
        expect(
            await screen.findByText(/Actual counter value/)
        ).toBeInTheDocument();
        await act(async () =>
            resolve({
                componentId: 'app',
                rootId: 'root',
                sections: [
                    {
                        name: 'props',
                        fields: [{ name: 'message', value: 'stale value' }]
                    }
                ]
            })
        );
        expect(screen.queryByText(/stale value/)).not.toBeInTheDocument();
    });
    it('reports inspection failure without demo values', async () => {
        const f = fixture();
        f.inspect.mockRejectedValue(new Error('Permission denied'));
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/components']} />
            </DevToolsSessionProvider>
        );
        expect(
            await screen.findByText('Permission denied')
        ).toBeInTheDocument();
        expect(screen.queryByText('Actual app value')).not.toBeInTheDocument();
    });
    it('reports unsupported inspection and empty roots honestly', () => {
        const f = fixture();
        f.update({
            capabilities: { ...f.snapshot.capabilities!, componentState: false }
        });
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/components']} />
            </DevToolsSessionProvider>
        );
        expect(screen.getByText('Inspection unsupported')).toBeInTheDocument();
        expect(f.inspect).not.toHaveBeenCalled();
        act(() =>
            f.update({ state: { ...f.snapshot.state!, components: [] } })
        );
        expect(screen.getByText('Empty React root')).toBeInTheDocument();
    });
    it('never derives app route counts from panel navigation', () => {
        const f = fixture();
        render(
            <DevToolsSessionProvider session={f.session}>
                <App initialEntries={['/overview']} />
            </DevToolsSessionProvider>
        );
        expect(screen.queryByText('12.4 ms')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
        fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
        expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
    });
});
