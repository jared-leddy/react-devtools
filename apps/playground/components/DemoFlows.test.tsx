import { act, fireEvent, render, screen } from '@testing-library/react';
import { ActivityLog } from './ActivityLog';
import { CounterDemo } from './CounterDemo';
import { TodoDemo } from './TodoDemo';

describe('playground demo flows', () => {
    it('adds, toggles, clears, and removes todos through the UI', () => {
        render(<TodoDemo />);

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

    it('renders the temporary demos without store dependencies', () => {
        render(
            <>
                <CounterDemo />
                <TodoDemo />
                <ActivityLog />
            </>
        );

        expect(screen.getByText('Counter demo')).toBeInTheDocument();
        expect(screen.getByText('Todo demo')).toBeInTheDocument();
        expect(screen.getByText('Activity log')).toBeInTheDocument();

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
            screen.getByText('Store action logging removed', { exact: false })
        ).toBeInTheDocument();
    });

    it('keeps active todos when clearing completed items', () => {
        render(<TodoDemo />);

        const input = screen.getByPlaceholderText('Add a todo…');
        const addButton = screen.getByRole('button', { name: 'add' });

        act(() => {
            fireEvent.change(input, {
                target: { value: 'Done item' }
            });
        });
        act(() => {
            addButton.click();
        });
        act(() => {
            fireEvent.change(input, {
                target: { value: 'Active item' }
            });
        });
        act(() => {
            addButton.click();
        });
        act(() => {
            screen.getAllByRole('checkbox')[0].click();
        });
        act(() => {
            screen.getByRole('button', { name: 'clear completed' }).click();
        });

        expect(screen.queryByText('Done item')).not.toBeInTheDocument();
        expect(screen.getByText('Active item')).toBeInTheDocument();
    });
});
