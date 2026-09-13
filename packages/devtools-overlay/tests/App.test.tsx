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

    it('creates one iframe lazily and reuses it across toggle clicks', () => {
        render(<DevtoolsOverlay clientUrl="/client/" />);

        const button = screen.getByRole('button', {
            name: 'Toggle React DevTools panel'
        });

        expect(document.querySelectorAll('iframe')).toHaveLength(0);

        fireEvent.click(button);

        const iframe = document.querySelector('iframe');

        expect(document.querySelectorAll('iframe')).toHaveLength(1);
        expect(iframe).toHaveAttribute('src', '/client/');
        expect(iframe).not.toHaveAttribute('hidden');

        fireEvent.click(button);

        expect(document.querySelectorAll('iframe')).toHaveLength(1);
        expect(document.querySelector('iframe')).toBe(iframe);
        expect(iframe).toHaveAttribute('hidden');

        fireEvent.click(button);

        expect(document.querySelectorAll('iframe')).toHaveLength(1);
        expect(document.querySelector('iframe')).toBe(iframe);
        expect(iframe).not.toHaveAttribute('hidden');
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
