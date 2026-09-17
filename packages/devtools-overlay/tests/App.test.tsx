import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DevtoolsOverlay, resolveDefaultInspectTarget } from '../src/App';

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

    it('draws a hover overlay and selects an inspected target on click', () => {
        const onInspectTarget = jest.fn();
        const target = document.createElement('button');

        target.setAttribute('data-react-devtools-component-id', 'component:1');
        target.setAttribute('data-react-devtools-root-id', 'root:1');
        target.setAttribute('data-react-devtools-source', '/src/App.tsx:4:12');
        target.getBoundingClientRect = jest.fn(() => ({
            bottom: 70,
            height: 40,
            left: 10,
            right: 110,
            top: 30,
            width: 100,
            x: 10,
            y: 30,
            toJSON() {
                return {};
            }
        }));
        document.body.appendChild(target);

        render(<DevtoolsOverlay onInspectTarget={onInspectTarget} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Toggle inspect mode' })
        );
        fireEvent.pointerMove(target);

        expect(screen.getByTestId('react-devtools-inspect-box')).toHaveStyle({
            height: '40px',
            left: '10px',
            top: '30px',
            width: '100px'
        });

        fireEvent.click(target);

        expect(onInspectTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                componentId: 'component:1',
                rootId: 'root:1',
                source: {
                    columnNumber: 12,
                    fileName: '/src/App.tsx',
                    lineNumber: 4
                }
            })
        );
        expect(
            screen.queryByTestId('react-devtools-inspect-box')
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Toggle inspect mode' })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('exits inspect mode on Escape and does not swallow later app clicks', () => {
        const appClick = jest.fn();
        const target = document.createElement('button');
        target.setAttribute('data-react-devtools-component-id', 'component:1');
        target.addEventListener('click', appClick);
        document.body.appendChild(target);

        render(<DevtoolsOverlay />);

        const inspectButton = screen.getByRole('button', {
            name: 'Toggle inspect mode'
        });

        fireEvent.click(inspectButton);
        expect(inspectButton).toHaveAttribute('aria-pressed', 'true');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(inspectButton).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(target);
        expect(appClick).toHaveBeenCalledTimes(1);
    });

    it('ignores overlay clicks and unresolved targets while inspecting', () => {
        const onInspectTarget = jest.fn();
        const appClick = jest.fn();
        const target = document.createElement('button');
        target.addEventListener('click', appClick);
        document.body.appendChild(target);

        render(<DevtoolsOverlay onInspectTarget={onInspectTarget} />);

        const inspectButton = screen.getByRole('button', {
            name: 'Toggle inspect mode'
        });

        fireEvent.click(inspectButton);
        fireEvent.pointerMove(inspectButton);
        fireEvent.click(inspectButton);
        fireEvent.click(target);

        expect(onInspectTarget).not.toHaveBeenCalled();
        expect(appClick).toHaveBeenCalledTimes(1);
    });

    it('clears inspect mode when the window loses focus', () => {
        render(<DevtoolsOverlay defaultInspecting />);

        const inspectButton = screen.getByRole('button', {
            name: 'Toggle inspect mode'
        });

        expect(inspectButton).toHaveAttribute('aria-pressed', 'true');

        fireEvent.blur(window);

        expect(inspectButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('resolves default inspect targets from component and source metadata', () => {
        const target = document.createElement('div');
        target.setAttribute('data-react-devtools-component-id', 'component:1');
        target.setAttribute('data-react-devtools-root-id', 'root:1');
        target.setAttribute(
            'data-react-devtools-source',
            'C:\\src\\App.tsx:2:7'
        );
        target.getBoundingClientRect = jest.fn(() => ({
            bottom: 20,
            height: 10,
            left: 5,
            right: 15,
            top: 10,
            width: 10,
            x: 5,
            y: 10,
            toJSON() {
                return {};
            }
        }));

        expect(resolveDefaultInspectTarget(target)).toMatchObject({
            componentId: 'component:1',
            domRect: { height: 10, width: 10, x: 5, y: 10 },
            rootId: 'root:1',
            source: {
                columnNumber: 7,
                fileName: 'C:\\src\\App.tsx',
                lineNumber: 2
            }
        });

        expect(
            resolveDefaultInspectTarget(document.createElement('span'))
        ).toBe(null);

        target.setAttribute('data-react-devtools-source', 'invalid');
        expect(resolveDefaultInspectTarget(target)).toMatchObject({
            componentId: 'component:1',
            source: undefined
        });
    });
});
