import { act, fireEvent, render, screen } from '@testing-library/react';
import { NekutaStore } from '../lib/nekuta-shim';
import { createNekuta } from '../lib/nekuta-store-shim';
import { useCounterStore } from '../stores/counterStore';
import { useTodoStore } from '../stores/todoStore';
import { ActivityLog } from './ActivityLog';
import { CounterDemo } from './CounterDemo';
import { TodoDemo } from './TodoDemo';

function renderWithStore(children: React.ReactNode) {
    return render(
        <NekutaStore nekuta={createNekuta()}>{children}</NekutaStore>
    );
}

describe('playground demo flows', () => {
    it('adds, toggles, clears, and removes todos through the UI', () => {
        renderWithStore(<TodoDemo />);

        const input = screen.getByPlaceholderText('Add a todo…');
        const addButton = screen.getByRole('button', { name: 'add' });

        act(() => {
            addButton.click();
        });

        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

        act(() => {
            fireEvent.change(input, {
                target: { value: 'Ship the devtools' }
            });
        });
        act(() => {
            addButton.click();
        });

        expect(screen.getByText('Ship the devtools')).toBeInTheDocument();
        expect(
            screen.getByText((_, element) =>
                Boolean(
                    element?.tagName === 'P' &&
                    element.textContent?.includes('remaining: 1')
                )
            )
        ).toBeInTheDocument();

        act(() => {
            screen.getByRole('checkbox').click();
        });
        expect(screen.getByText('Ship the devtools')).toHaveStyle({
            textDecoration: 'line-through'
        });

        act(() => {
            screen.getByRole('button', { name: 'clear completed' }).click();
        });
        expect(screen.queryByText('Ship the devtools')).not.toBeInTheDocument();

        act(() => {
            fireEvent.change(input, {
                target: { value: 'Remove me' }
            });
        });
        act(() => {
            addButton.click();
        });
        act(() => {
            screen.getByRole('button', { name: 'remove' }).click();
        });

        expect(screen.queryByText('Remove me')).not.toBeInTheDocument();
    });

    it('records store subscriptions and action lifecycle events', () => {
        renderWithStore(
            <>
                <CounterDemo />
                <TodoDemo />
                <ActivityLog />
            </>
        );

        act(() => {
            screen.getByText('+1').click();
        });

        expect(
            screen.getByText('[$onAction] counter.increment called', {
                exact: false
            })
        ).toBeInTheDocument();
        expect(
            screen.getByText('[$subscribe] counter store changed', {
                exact: false
            })
        ).toBeInTheDocument();

        const input = screen.getByPlaceholderText('Add a todo…');
        act(() => {
            fireEvent.change(input, {
                target: { value: 'Log this' }
            });
        });
        act(() => {
            screen.getByRole('button', { name: 'add' }).click();
        });

        expect(
            screen.getByText('[$onAction] todos.addTodo called', {
                exact: false
            })
        ).toBeInTheDocument();
    });

    it('keeps direct store actions usable for SSR-style setup', () => {
        const nekuta = createNekuta();
        const counter = useCounterStore(nekuta);
        const todos = useTodoStore(nekuta);

        counter.increment(2);
        counter.decrement();
        todos.addTodo('Direct store item');
        todos.toggleTodo(1);
        todos.toggleTodo(404);
        todos.removeTodo(404);

        expect(counter.count).toBe(1);
        expect(counter.doubleCount).toBe(2);
        expect(todos.completedCount).toBe(1);
        expect(todos.remainingCount).toBe(0);
    });
});
