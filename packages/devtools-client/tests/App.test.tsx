import { render, screen } from '@testing-library/react';
import { App } from '../src';

describe('@devtools/client App', () => {
    it('renders the client shell without throwing', () => {
        render(<App />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'React DevTools' })
        ).toBeInTheDocument();
        expect(screen.getByText('Client shell ready.')).toBeInTheDocument();
    });

    it('can render without the default memory router wrapper', () => {
        render(<App router="none" />);

        expect(
            screen.getByRole('main', { name: 'React DevTools client' })
        ).toBeInTheDocument();
    });
});
