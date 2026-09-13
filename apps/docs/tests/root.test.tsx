import { render, screen } from '@testing-library/react';
import React from 'react';

import Root from '../src/theme/Root';

describe('Root', () => {
    it('renders its children without branded chrome', () => {
        render(
            <Root>
                <div>Child Content</div>
            </Root>
        );

        expect(screen.getByText('Child Content')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '+' })
        ).not.toBeInTheDocument();
    });
});
