import { render, screen } from '@testing-library/react';
import React from 'react';

import Home from '../src/pages/index';

describe('Home', () => {
    it('renders the React DevTools hero copy', () => {
        render(<Home />);

        expect(
            screen.getByRole('heading', { name: 'React DevTools', level: 1 })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'A modern developer tools ecosystem for React apps.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /Component inspection, framework integrations, plugin APIs/
            )
        ).toBeInTheDocument();
    });

    it('passes the page title and description to Layout', () => {
        render(<Home />);

        const layout = screen.getByTestId('layout');
        expect(layout).toHaveAttribute('data-title', 'React DevTools');
        expect(layout).toHaveAttribute(
            'data-description',
            'A modern developer tools ecosystem for React apps.'
        );
    });

    it('links to the docs intro and the React DevTools repository', () => {
        render(<Home />);

        expect(
            screen.getByRole('link', { name: 'Read the Docs' })
        ).toHaveAttribute('href', '/docs/intro');
        expect(
            screen.getByRole('link', { name: 'View on GitHub' })
        ).toHaveAttribute(
            'href',
            'https://github.com/jared-leddy/react-devtools'
        );
    });

    it('renders the placeholder project direction cards', () => {
        render(<Home />);

        const titles = [
            'Component Tree Explorer',
            'Framework Integrations',
            'Plugin Surface',
            'Beautiful Development UI'
        ];

        for (const title of titles) {
            expect(
                screen.getByRole('heading', { name: title, level: 3 })
            ).toBeInTheDocument();
        }
    });

    it('renders the roadmap preview instead of a store quick-start snippet', () => {
        render(<Home />);

        expect(
            screen.getByText('What lands before the docs are final')
        ).toBeInTheDocument();
        expect(
            screen.getByText('Fiber walker and component inspection')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('code-block')).not.toBeInTheDocument();
        expect(screen.queryByText(/defineStore/)).not.toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Start with the Project Notes' })
        ).toHaveAttribute('href', '/docs/intro');
    });
});
