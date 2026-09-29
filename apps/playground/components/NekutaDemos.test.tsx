import { act, render, screen } from '@testing-library/react';
import { registerNekutaDevTools } from '@devtools/nekuta-plugin';
import { NekutaDemos } from './NekutaDemos';

jest.mock('@devtools/nekuta-plugin', () => ({
    registerNekutaDevTools: jest.fn()
}));

jest.mock('@nekuta/core', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const NekutaContext = React.createContext<{
        _s: Map<string, unknown>;
        listeners: Set<() => void>;
    } | null>(null);

    function createStore(
        definition: {
            actions?: Record<string, (...args: never[]) => unknown>;
            getters?: Record<
                string,
                (state: Record<string, unknown>) => unknown
            >;
            id: string;
            state?: () => Record<string, unknown>;
        },
        nekuta: { _s: Map<string, unknown>; listeners: Set<() => void> }
    ) {
        const state = definition.state?.() ?? {};
        const store: Record<string, unknown> = { ...state };
        const notify = () => {
            nekuta.listeners.forEach((listener) => listener());
        };

        for (const [key, getter] of Object.entries(definition.getters ?? {})) {
            Object.defineProperty(store, key, {
                enumerable: true,
                get: () => getter(store)
            });
        }

        for (const [key, action] of Object.entries(definition.actions ?? {})) {
            store[key] = (...args: never[]) => {
                const result = action.apply(store, args);
                notify();

                return result;
            };
        }

        nekuta._s.set(definition.id, store);

        return store;
    }

    return {
        createNekuta: () => ({
            _s: new Map(),
            listeners: new Set()
        }),
        defineStore: (definition: {
            actions?: Record<string, (...args: never[]) => unknown>;
            getters?: Record<
                string,
                (state: Record<string, unknown>) => unknown
            >;
            id: string;
            state?: () => Record<string, unknown>;
        }) => {
            const useDefinition = (nekuta: {
                _s: Map<string, unknown>;
                listeners: Set<() => void>;
            }) => {
                if (!nekuta._s.has(definition.id)) {
                    createStore(definition, nekuta);
                }

                return nekuta._s.get(definition.id);
            };

            useDefinition.$id = definition.id;

            return useDefinition;
        },
        disposeNekuta: jest.fn(),
        NekutaStore: ({
            children,
            nekuta
        }: {
            children: import('react').ReactNode;
            nekuta: { _s: Map<string, unknown>; listeners: Set<() => void> };
        }) =>
            React.createElement(
                NekutaContext.Provider,
                {
                    value: nekuta
                },
                children
            ),
        useStore: (
            useDefinition: (nekuta: {
                _s: Map<string, unknown>;
                listeners: Set<() => void>;
            }) => unknown
        ) => {
            const nekuta = React.useContext(NekutaContext);
            const [, rerender] = React.useState(0);

            if (!nekuta) {
                throw new Error('Missing mocked Nekuta provider');
            }

            React.useEffect(() => {
                const listener = () => {
                    rerender((value) => value + 1);
                };

                nekuta.listeners.add(listener);

                return () => {
                    nekuta.listeners.delete(listener);
                };
            }, [nekuta]);

            return useDefinition(nekuta);
        }
    };
});

describe('Nekuta playground demos', () => {
    beforeEach(() => {
        jest.mocked(registerNekutaDevTools).mockReset();
    });

    it('registers the Nekuta DevTools plugin and renders two demo stores', () => {
        render(<NekutaDemos />);

        expect(registerNekutaDevTools).toHaveBeenCalledWith({
            label: 'Nekuta Playground',
            nekuta: expect.objectContaining({
                _s: expect.any(Map)
            })
        });
        expect(
            screen.getByRole('heading', { name: 'counter store' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'todo store' })
        ).toBeInTheDocument();
        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '0'
        );
        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('1');
    });

    it('updates the counter store through Nekuta actions', () => {
        render(<NekutaDemos />);

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '1'
        );
        expect(screen.getByTestId('nekuta-counter-doubled')).toHaveTextContent(
            '2'
        );

        act(() => {
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('nekuta-counter-count')).toHaveTextContent(
            '0'
        );
    });

    it('updates the todo store through Nekuta actions', () => {
        render(<NekutaDemos />);

        act(() => {
            screen.getByRole('button', { name: 'Add todo' }).click();
        });

        expect(screen.getByTestId('nekuta-todo-list')).toHaveTextContent(
            'Review timeline event'
        );
        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('2');

        act(() => {
            screen.getByRole('button', { name: 'Toggle first todo' }).click();
        });

        expect(screen.getByTestId('nekuta-open-todos')).toHaveTextContent('1');
    });
});
