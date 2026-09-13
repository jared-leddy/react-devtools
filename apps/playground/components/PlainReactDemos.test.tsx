import { act, render, screen } from '@testing-library/react';
import {
    ClassStateDemo,
    ContextProviderDemo,
    MemoStatusDemo,
    PlainReactDemos,
    ReducerCounterDemo,
    StateCounterDemo,
    SuspenseLazyDemo
} from './PlainReactDemos';

describe('plain React playground demos', () => {
    it('mounts the useState component and updates local state', () => {
        render(<StateCounterDemo />);

        expect(screen.getByTestId('state-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('state-count')).toHaveTextContent('1');

        act(() => {
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('state-count')).toHaveTextContent('0');
    });

    it('mounts the useReducer component and dispatches actions', () => {
        render(<ReducerCounterDemo />);

        expect(screen.getByTestId('reducer-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
            screen.getByRole('button', { name: 'Decrement' }).click();
            screen.getByRole('button', { name: 'Reset' }).click();
        });

        expect(screen.getByTestId('reducer-count')).toHaveTextContent('0');
    });

    it('mounts the useContext provider and updates the provided value', () => {
        render(<ContextProviderDemo />);

        expect(screen.getByTestId('context-tone')).toHaveTextContent('quiet');

        act(() => {
            screen.getByRole('button', { name: 'Set active' }).click();
        });

        expect(screen.getByTestId('context-tone')).toHaveTextContent('active');

        act(() => {
            screen.getByRole('button', { name: 'Set quiet' }).click();
        });

        expect(screen.getByTestId('context-tone')).toHaveTextContent('quiet');
    });

    it('mounts the memo component and keeps its own interaction state', () => {
        render(<MemoStatusDemo label="Memo status" />);

        expect(screen.getByTestId('memo-status')).toHaveTextContent(
            'Memo status: idle'
        );

        act(() => {
            screen.getByRole('button', { name: 'Toggle memo state' }).click();
        });

        expect(screen.getByTestId('memo-status')).toHaveTextContent(
            'Memo status: selected'
        );
    });

    it('mounts the Suspense boundary and resolves the lazy child', async () => {
        render(<SuspenseLazyDemo />);

        expect(screen.getByTestId('lazy-fallback')).toHaveTextContent(
            'Loading lazy child...'
        );
        expect(await screen.findByTestId('lazy-panel')).toHaveTextContent(
            'Lazy child resolved'
        );
    });

    it('mounts the class component and updates this.state', () => {
        render(<ClassStateDemo />);

        expect(screen.getByTestId('class-count')).toHaveTextContent('0');

        act(() => {
            screen.getByRole('button', { name: 'Increment' }).click();
        });

        expect(screen.getByTestId('class-count')).toHaveTextContent('1');
    });

    it('renders the combined fixture surface', async () => {
        render(<PlainReactDemos />);

        expect(screen.getByText('useState component')).toBeInTheDocument();
        expect(screen.getByText('useReducer component')).toBeInTheDocument();
        expect(screen.getByText('useContext provider')).toBeInTheDocument();
        expect(screen.getByText('memo component')).toBeInTheDocument();
        expect(screen.getByText('Suspense boundary')).toBeInTheDocument();
        expect(screen.getByText('class component')).toBeInTheDocument();
        expect(await screen.findByTestId('lazy-panel')).toBeInTheDocument();
    });
});
