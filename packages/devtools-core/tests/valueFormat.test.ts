import { formatDisplayableValue } from '../src/index.js';

describe('displayable value formatter', () => {
    it('returns JSON-safe primitive values directly', () => {
        expect(formatDisplayableValue(null)).toBeNull();
        expect(formatDisplayableValue('hello')).toBe('hello');
        expect(formatDisplayableValue(42)).toBe(42);
        expect(formatDisplayableValue(true)).toBe(true);
    });

    it('formats non-JSON primitive values as custom placeholders', () => {
        expect(formatDisplayableValue(undefined)).toEqual({
            _custom: {
                display: 'undefined',
                type: 'undefined'
            }
        });
        expect(formatDisplayableValue(10n)).toEqual({
            _custom: {
                display: '10n',
                type: 'bigint'
            }
        });
        expect(formatDisplayableValue(Symbol('token'))).toEqual({
            _custom: {
                display: 'Symbol(token)',
                type: 'symbol'
            }
        });
        expect(formatDisplayableValue(Number.POSITIVE_INFINITY)).toEqual({
            _custom: {
                display: 'Infinity',
                type: 'number'
            }
        });
    });

    it('formats plain objects and arrays recursively', () => {
        expect(
            formatDisplayableValue({
                count: 2,
                items: ['a', 'b'],
                nested: { enabled: false }
            })
        ).toEqual({
            _custom: {
                display: 'Object',
                type: 'object',
                value: {
                    count: 2,
                    items: {
                        _custom: {
                            display: 'Array(2)',
                            type: 'array',
                            value: ['a', 'b']
                        }
                    },
                    nested: {
                        _custom: {
                            display: 'Object',
                            type: 'object',
                            value: {
                                enabled: false
                            }
                        }
                    }
                }
            }
        });
    });

    it('formats maps as entry placeholders', () => {
        expect(
            formatDisplayableValue(
                new Map<unknown, unknown>([
                    ['theme', 'dark'],
                    [{ id: 1 }, new Set(['read'])]
                ])
            )
        ).toEqual({
            _custom: {
                display: 'Map(2)',
                type: 'map',
                value: [
                    {
                        _custom: {
                            display: 'Entry 0',
                            type: 'map-entry',
                            value: ['theme', 'dark']
                        }
                    },
                    {
                        _custom: {
                            display: 'Entry 1',
                            type: 'map-entry',
                            value: [
                                {
                                    _custom: {
                                        display: 'Object',
                                        type: 'object',
                                        value: { id: 1 }
                                    }
                                },
                                {
                                    _custom: {
                                        display: 'Set(1)',
                                        type: 'set',
                                        value: ['read']
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        });
    });

    it('formats sets as ordered values', () => {
        expect(formatDisplayableValue(new Set(['read', 'write']))).toEqual({
            _custom: {
                display: 'Set(2)',
                type: 'set',
                value: ['read', 'write']
            }
        });
    });

    it('formats functions as read-only placeholders without source text', () => {
        function handleClick(): string {
            return 'source should not leak';
        }

        expect(formatDisplayableValue(handleClick)).toEqual({
            _custom: {
                display: 'ƒ handleClick()',
                readOnly: true,
                type: 'function'
            }
        });
    });

    it('formats DOM-like nodes as read-only tag placeholders', () => {
        expect(
            formatDisplayableValue({
                nodeName: 'BUTTON',
                nodeType: 1,
                tagName: 'BUTTON',
                textContent: 'Do not serialize me'
            })
        ).toEqual({
            _custom: {
                display: '<button>',
                readOnly: true,
                type: 'dom-node'
            }
        });
    });

    it('formats class instances with constructor name and own properties', () => {
        class CounterModel {
            count = 3;
            label = 'Clicks';

            increment(): void {
                this.count += 1;
            }
        }

        expect(formatDisplayableValue(new CounterModel())).toEqual({
            _custom: {
                display: 'CounterModel',
                type: 'instance',
                value: {
                    count: 3,
                    label: 'Clicks'
                }
            }
        });
    });

    it('stops at the configured depth and does not follow cycles', () => {
        const value: Record<string, unknown> = { label: 'root' };
        value.self = value;
        value.child = { child: { child: { child: 'too deep' } } };

        expect(formatDisplayableValue(value, { maxDepth: 2 })).toEqual({
            _custom: {
                display: 'Object',
                type: 'object',
                value: {
                    child: {
                        _custom: {
                            display: 'Object',
                            type: 'object',
                            value: {
                                child: {
                                    _custom: {
                                        display: '[MaxDepth]',
                                        type: 'Object'
                                    }
                                }
                            }
                        }
                    },
                    label: 'root',
                    self: {
                        _custom: {
                            display: '[Circular]',
                            type: 'circular'
                        }
                    }
                }
            }
        });
    });

    it('limits formatted collection and object entry counts', () => {
        expect(
            formatDisplayableValue(
                {
                    a: 1,
                    b: 2,
                    c: 3
                },
                { maxEntries: 2 }
            )
        ).toEqual({
            _custom: {
                display: 'Object',
                type: 'object',
                value: {
                    a: 1,
                    b: 2
                }
            }
        });
        expect(formatDisplayableValue([1, 2, 3], { maxEntries: 2 })).toEqual({
            _custom: {
                display: 'Array(3)',
                type: 'array',
                value: [1, 2]
            }
        });
    });
});
