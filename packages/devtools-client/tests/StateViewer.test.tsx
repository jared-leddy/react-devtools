import { fireEvent, render, screen, within } from '@testing-library/react';
import { StateViewer, type StateViewerSection } from '../src';

const formattedSections: StateViewerSection[] = [
    {
        fields: [
            { name: 'title', value: 'Dashboard' },
            {
                name: 'items',
                value: {
                    _custom: {
                        display: 'Map(1)',
                        type: 'map',
                        value: [
                            {
                                _custom: {
                                    display: 'Entry 0',
                                    type: 'map-entry',
                                    value: ['active', true]
                                }
                            }
                        ]
                    }
                }
            },
            {
                name: 'node',
                value: {
                    _custom: {
                        display: '<button>',
                        readOnly: true,
                        type: 'dom-node'
                    }
                }
            },
            {
                name: 'instance',
                value: {
                    _custom: {
                        display: 'ViewModel',
                        type: 'instance',
                        value: {
                            id: 'vm-1'
                        }
                    }
                }
            }
        ],
        name: 'props'
    },
    {
        fields: [
            {
                name: 'Hook 0 (state)',
                value: {
                    _custom: {
                        display: 'Set(2)',
                        type: 'set',
                        value: ['alpha', 'beta']
                    }
                }
            },
            {
                name: 'Hook 1 (memo)',
                value: {
                    _custom: {
                        display: 'ƒ computeRows()',
                        readOnly: true,
                        type: 'function'
                    }
                }
            }
        ],
        name: 'hooks'
    },
    {
        fields: [{ name: 'count', value: 3 }],
        name: 'state'
    }
];

describe('StateViewer', () => {
    it('renders grouped formatted props, hooks, and class state values', () => {
        render(<StateViewer sections={formattedSections} />);

        const props = screen.getByRole('region', { name: 'Props' });
        const hooks = screen.getByRole('region', { name: 'Hooks' });
        const classState = screen.getByRole('region', {
            name: 'Class State'
        });

        expect(within(props).getByText('title')).toBeInTheDocument();
        expect(within(props).getByText('"Dashboard"')).toBeInTheDocument();
        expect(within(props).getByText('Map(1)')).toBeInTheDocument();
        expect(within(props).getByText('Entry 0')).toBeInTheDocument();
        expect(within(props).getByText('<button>')).toBeInTheDocument();
        expect(within(props).getByText('dom-node')).toBeInTheDocument();
        expect(within(props).getByText('ViewModel')).toBeInTheDocument();
        expect(within(props).getByText('"vm-1"')).toBeInTheDocument();
        expect(within(hooks).getByText('Set(2)')).toBeInTheDocument();
        expect(within(hooks).getByText('Value 0')).toBeInTheDocument();
        expect(within(hooks).getByText('ƒ computeRows()')).toBeInTheDocument();
        expect(within(classState).getByText('count')).toBeInTheDocument();
        expect(within(classState).getByText('3')).toBeInTheDocument();
    });

    it('keeps the generic viewer read-only without edit controls', () => {
        const { container } = render(
            <StateViewer sections={formattedSections} />
        );

        expect(screen.getByText('Read-only')).toBeInTheDocument();
        expect(
            screen.getAllByText('read-only', { exact: false }).length
        ).toBeGreaterThan(0);
        expect(
            screen.queryByRole('button', { name: /edit|save|reset/i })
        ).not.toBeInTheDocument();
        expect(container.querySelector('input')).not.toBeInTheDocument();
        expect(container.querySelector('textarea')).not.toBeInTheDocument();
        expect(container.querySelector('select')).not.toBeInTheDocument();
    });

    it('renders edit controls only for explicitly editable fields', () => {
        const onEditField = jest.fn();

        render(
            <StateViewer
                onEditField={onEditField}
                sections={[
                    {
                        fields: [
                            { name: 'readonly', value: 'fixed' },
                            {
                                editable: true,
                                name: 'options',
                                value: {
                                    _custom: {
                                        display: 'Object',
                                        preview: '{"enabled":true}',
                                        type: 'object',
                                        value: { enabled: true }
                                    }
                                }
                            }
                        ],
                        name: 'state'
                    }
                ]}
            />
        );

        expect(
            screen.getByText('Editable fields available')
        ).toBeInTheDocument();
        expect(
            screen.queryByLabelText('Edit readonly value')
        ).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Edit options key'), {
            target: { value: 'config' }
        });
        fireEvent.change(screen.getByLabelText('Edit options value'), {
            target: { value: '{"enabled":false}' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onEditField).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'options' }),
            {
                newKey: 'config',
                type: 'set',
                value: {
                    _custom: {
                        display: 'Object',
                        preview: '{"enabled":false}',
                        type: 'object',
                        value: { enabled: false }
                    }
                }
            }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(onEditField).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'options' }),
            { type: 'remove' }
        );
    });
});
