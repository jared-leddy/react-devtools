import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import {
    Button,
    Card,
    CodeBlock,
    Dialog,
    Dropdown,
    Notification,
    Select,
    Switch,
    ThemeProvider,
    ThemeToggle,
    Tooltip,
    UIShowcase,
    useTheme
} from '../src';

describe('@devtools/ui components', () => {
    it('calls button handlers', () => {
        const onClick = jest.fn();
        render(<Button onClick={onClick}>Inspect</Button>);

        fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders icon-only buttons', () => {
        render(<Button aria-label="Refresh" icon={<span>R</span>} />);

        expect(
            screen.getByRole('button', { name: 'Refresh' })
        ).toHaveTextContent('R');
    });

    it('renders card regions with actions and footer', () => {
        render(
            <Card
                actions={<Button>Run</Button>}
                footer="Updated just now"
                title="Components"
            >
                Panel content
            </Card>
        );

        expect(
            screen.getByRole('heading', { name: 'Components' })
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
        expect(screen.getByText('Updated just now')).toBeInTheDocument();
    });

    it('renders body-only cards', () => {
        render(<Card>Quiet content</Card>);

        expect(screen.getByText('Quiet content')).toBeInTheDocument();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('closes dialogs from the close action', () => {
        const onOpenChange = jest.fn();
        render(
            <Dialog
                description="Choose a node"
                open
                title="Inspector"
                onOpenChange={onOpenChange}
            >
                Dialog body
            </Dialog>
        );

        expect(
            screen.getByRole('dialog', { name: 'Inspector' })
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getAllByRole('button', { name: 'Close dialog' })[1]
        );

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('keeps closed dialogs out of the tree', () => {
        render(
            <Dialog
                open={false}
                title="Hidden inspector"
                onOpenChange={jest.fn()}
            >
                Dialog body
            </Dialog>
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes dialogs from the backdrop', () => {
        const onOpenChange = jest.fn();
        render(
            <Dialog open title="Backdrop inspector" onOpenChange={onOpenChange}>
                Dialog body
            </Dialog>
        );

        fireEvent.click(screen.getAllByLabelText('Close dialog')[0]);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('selects dropdown items and closes the menu', () => {
        const onSelect = jest.fn();
        render(
            <Dropdown
                buttonLabel="Actions"
                items={[{ id: 'copy', label: 'Copy selector', onSelect }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
        fireEvent.click(
            screen.getByRole('menuitem', { name: 'Copy selector' })
        );

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByRole('menuitem', { name: 'Copy selector' })
        ).not.toBeInTheDocument();
    });

    it('changes select values', () => {
        const onChange = jest.fn();
        render(
            <Select
                label="Panel"
                options={[
                    { label: 'Components', value: 'components' },
                    { label: 'Profiler', value: 'profiler' }
                ]}
                value="components"
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByLabelText('Panel'), {
            target: { value: 'profiler' }
        });

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('toggles switches', () => {
        function SwitchHarness() {
            const [checked, setChecked] = useState(false);
            return (
                <Switch
                    checked={checked}
                    label="Highlight updates"
                    onCheckedChange={setChecked}
                />
            );
        }

        render(<SwitchHarness />);

        const control = screen.getByRole('switch', {
            name: 'Highlight updates'
        });
        expect(control).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(control);

        expect(control).toHaveAttribute('aria-checked', 'true');
    });

    it('shows tooltips on focus and hides them on blur', () => {
        render(
            <Tooltip label="Open details">
                <button type="button">Details</button>
            </Tooltip>
        );

        const trigger = screen.getByRole('button', { name: 'Details' });
        fireEvent.focus(trigger);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Open details');

        fireEvent.blur(trigger);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows tooltips on hover and hides them on leave', () => {
        render(
            <Tooltip label="Open details">
                <button type="button">Details</button>
            </Tooltip>
        );

        fireEvent.mouseEnter(screen.getByText('Details'));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Open details');

        fireEvent.mouseLeave(screen.getByText('Details'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dismisses notifications', () => {
        const onClose = jest.fn();
        render(
            <Notification title="Connected" tone="success" onClose={onClose}>
                Backend is ready
            </Notification>
        );

        expect(screen.getByRole('status')).toHaveTextContent(
            'Backend is ready'
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Dismiss notification' })
        );

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders compact notifications without optional content', () => {
        render(<Notification title="Queued" tone="warning" />);

        expect(screen.getByRole('status')).toHaveTextContent('Queued');
        expect(
            screen.queryByRole('button', { name: 'Dismiss notification' })
        ).not.toBeInTheDocument();
    });

    it('renders code immediately and upgrades to highlighted markup', async () => {
        render(
            <CodeBlock code="const value = 1;" language="ts" theme="light" />
        );

        expect(screen.getByText('const value = 1;')).toBeInTheDocument();

        await waitFor(() => {
            expect(
                document.querySelector('.dt-code-block__highlight')
            ).toBeInTheDocument();
        });
    });

    it('falls back to plain code when highlighting fails', async () => {
        render(<CodeBlock code="plain" language="broken" />);

        await waitFor(() => {
            expect(screen.getByText('plain')).toBeInTheDocument();
        });
        expect(
            document.querySelector('.dt-code-block__highlight')
        ).not.toBeInTheDocument();
    });

    it('uses default code block options', async () => {
        render(<CodeBlock code="<Panel />" />);

        await waitFor(() => {
            expect(
                document.querySelector('.dt-code-block__highlight')
            ).toBeInTheDocument();
        });
    });

    it('toggles light and dark themes', () => {
        function ThemeProbe() {
            const { theme } = useTheme();
            return <span>theme:{theme}</span>;
        }

        render(
            <ThemeProvider defaultTheme="light">
                <ThemeToggle />
                <ThemeProbe />
            </ThemeProvider>
        );

        expect(screen.getByText('theme:light')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Light' }));

        expect(screen.getByText('theme:dark')).toBeInTheDocument();
    });

    it('guards useTheme outside the provider', () => {
        function BrokenProbe() {
            useTheme();
            return null;
        }

        const consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        expect(() => render(<BrokenProbe />)).toThrow(
            'useTheme must be used within ThemeProvider.'
        );

        consoleError.mockRestore();
    });

    it('renders the local showcase harness', async () => {
        render(<UIShowcase />);

        expect(
            screen.getByRole('heading', { name: 'React DevTools UI Kit' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Dark' })
        ).toBeInTheDocument();
        await waitFor(() => {
            expect(
                document.querySelector('.dt-code-block__highlight')
            ).toBeInTheDocument();
        });
    });
});
