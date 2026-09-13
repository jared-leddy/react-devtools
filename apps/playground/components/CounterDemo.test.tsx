import { act, render, screen } from '@testing-library/react';
import { CounterDemo } from './CounterDemo';

function renderDemo() {
    return render(<CounterDemo />);
}

describe('CounterDemo', () => {
    it('renders all three shared counter views', () => {
        renderDemo();

        expect(screen.getByText('Functional state')).toBeInTheDocument();
        expect(screen.getByText('Shared state view')).toBeInTheDocument();
        expect(screen.getByText('Derived state view')).toBeInTheDocument();
        expect(screen.getByTestId('functional-count')).toHaveTextContent('0');
        expect(screen.getByTestId('class-count')).toHaveTextContent('0');
        expect(screen.getByTestId('static-class-count')).toHaveTextContent('0');
    });

    it('a click on the functional view updates all shared views', () => {
        renderDemo();

        act(() => {
            screen.getByText('+1').click();
        });

        expect(screen.getByTestId('functional-count')).toHaveTextContent('1');
        expect(screen.getByTestId('class-count')).toHaveTextContent('1');
        expect(screen.getByTestId('static-class-count')).toHaveTextContent('1');
    });

    it('a click on the derived state view updates the other two too', () => {
        renderDemo();

        act(() => {
            screen.getByText('+10').click();
        });

        expect(screen.getByTestId('functional-count')).toHaveTextContent('10');
        expect(screen.getByTestId('class-count')).toHaveTextContent('10');
        expect(screen.getByTestId('static-class-count')).toHaveTextContent(
            '10'
        );
    });

    it('supports decrementing and resetting the shared state', () => {
        renderDemo();

        act(() => {
            screen.getByText('+1').click();
            screen.getByText('-1').click();
            screen.getByText('+10').click();
            screen.getByText('reset').click();
        });

        expect(screen.getByTestId('functional-count')).toHaveTextContent('0');
        expect(screen.getByTestId('class-count')).toHaveTextContent('0');
        expect(screen.getByTestId('static-class-count')).toHaveTextContent('0');
    });

    it('supports each shared view decrement path', () => {
        renderDemo();

        act(() => {
            screen.getByText('-5').click();
            screen.getByText('-10').click();
        });

        expect(screen.getByTestId('functional-count')).toHaveTextContent('-15');
        expect(screen.getByTestId('class-count')).toHaveTextContent('-15');
        expect(screen.getByTestId('static-class-count')).toHaveTextContent(
            '-15'
        );
    });
});
