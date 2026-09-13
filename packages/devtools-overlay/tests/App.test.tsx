import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DevtoolsOverlay } from '../src/App';

describe('DevtoolsOverlay', () => {
    it('renders a fixed-position toggle button', () => {
        render(<DevtoolsOverlay />);

        const overlay = screen.getByTestId('react-devtools-overlay');
        const button = screen.getByRole('button', {
            name: 'Toggle React DevTools panel'
        });

        expect(overlay).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toHaveClass('react-devtools-overlay__toggle');
    });

    it('toggles the open state and reports changes when clicked', () => {
        const onToggle = jest.fn();
        render(<DevtoolsOverlay onToggle={onToggle} />);

        const button = screen.getByRole('button', {
            name: 'Toggle React DevTools panel'
        });

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('react-devtools-overlay')).toHaveAttribute(
            'data-open',
            'true'
        );
        expect(onToggle).toHaveBeenCalledWith(true);

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(onToggle).toHaveBeenLastCalledWith(false);
    });

    it('keeps the overlay fixed to the viewport corner', () => {
        const styles = readFileSync(
            join(process.cwd(), 'src/style.css'),
            'utf8'
        );

        expect(styles).toContain('position: fixed');
        expect(styles).toContain('right: 20px');
        expect(styles).toContain('bottom: 20px');
        expect(styles).toContain('z-index: 2147483645');
    });
});
