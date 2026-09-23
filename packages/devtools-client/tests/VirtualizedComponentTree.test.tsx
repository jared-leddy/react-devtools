import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
    VirtualizedComponentTree,
    generateSyntheticComponentTree
} from '../src';

const largeTree = generateSyntheticComponentTree(20, 25);

describe('VirtualizedComponentTree', () => {
    it('renders a bounded window for a 500+ node tree', () => {
        render(
            <VirtualizedComponentTree
                height={180}
                nodes={largeTree}
                rowHeight={30}
            />
        );

        expect(screen.getByText('520 visible nodes')).toBeInTheDocument();
        expect(screen.getByText('ComponentGroup0')).toBeInTheDocument();
        expect(screen.queryByText('ComponentGroup19')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button').length).toBeLessThan(40);
    });

    it('scrolls a specific off-screen node into the virtual window', async () => {
        const { rerender } = render(
            <VirtualizedComponentTree
                height={180}
                nodes={largeTree}
                rowHeight={30}
            />
        );

        rerender(
            <VirtualizedComponentTree
                height={180}
                nodes={largeTree}
                rowHeight={30}
                scrollToId="component-group-19-child-24"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('ComponentLeaf19_24')).toBeInTheDocument();
        });
    });

    it('keeps selection and expansion state when rows leave and re-enter the window', async () => {
        const { rerender } = render(
            <VirtualizedComponentTree
                height={180}
                initialSelectedId="component-group-0-child-1"
                nodes={largeTree}
                rowHeight={30}
            />
        );

        expect(
            screen.getByText('ComponentLeaf0_1').closest('[aria-selected]')
        ).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(
            screen.getByRole('button', { name: 'Collapse ComponentGroup0' })
        );
        expect(screen.queryByText('ComponentLeaf0_1')).not.toBeInTheDocument();

        rerender(
            <VirtualizedComponentTree
                height={180}
                initialSelectedId="component-group-0-child-1"
                nodes={largeTree}
                rowHeight={30}
                scrollToId="component-group-19-child-24"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('ComponentLeaf19_24')).toBeInTheDocument();
        });

        rerender(
            <VirtualizedComponentTree
                height={180}
                initialSelectedId="component-group-0-child-1"
                nodes={largeTree}
                rowHeight={30}
                scrollToId="component-group-0"
            />
        );

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Expand ComponentGroup0' })
            ).toBeInTheDocument();
        });
        expect(screen.queryByText('ComponentLeaf0_1')).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Expand ComponentGroup0' })
        );

        await waitFor(() => {
            expect(
                screen.getByText('ComponentLeaf0_1').closest('[aria-selected]')
            ).toHaveAttribute('aria-selected', 'true');
        });
    });

    it('selects a row and reports hover highlight lifecycle through the bridge', () => {
        const highlightElement = jest.fn();
        const highlightComponent = jest.fn();
        const unhighlightElement = jest.fn();
        const handleSelectedIdChange = jest.fn();

        render(
            <VirtualizedComponentTree
                height={180}
                highlightBridge={{
                    highlightComponent,
                    highlightElement,
                    unhighlightElement
                }}
                nodes={largeTree}
                onSelectedIdChange={handleSelectedIdChange}
                rowHeight={30}
            />
        );

        const targetLabel = screen.getByText('ComponentLeaf0_5');
        const targetRow = targetLabel.closest('[data-node-id]');

        expect(targetRow).toBeInTheDocument();

        fireEvent.mouseEnter(targetRow as Element);
        expect(highlightElement).toHaveBeenCalledWith({
            componentId: 'component-group-0-child-5',
            elementId: 'element-0-5',
            rootId: 'synthetic-root'
        });
        expect(highlightComponent).toHaveBeenCalledWith({
            componentId: 'component-group-0-child-5',
            elementId: 'element-0-5',
            rootId: 'synthetic-root'
        });

        fireEvent.mouseLeave(targetRow as Element);
        expect(unhighlightElement).toHaveBeenCalledTimes(1);

        fireEvent.click(targetLabel.closest('button') as Element);
        expect(handleSelectedIdChange).toHaveBeenCalledWith(
            'component-group-0-child-5'
        );
        expect(targetRow).toHaveAttribute('aria-selected', 'true');
    });
});
