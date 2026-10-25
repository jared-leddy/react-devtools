import {
    getComponentStateSections,
    getHooks,
    formatDisplayableValue,
    ReactFiberTag,
    type ReactFiber
} from '../src/index.js';
const fiber = (overrides: Partial<ReactFiber>) =>
    ({
        tag: ReactFiberTag.FunctionComponent,
        memoizedState: null,
        memoizedProps: {},
        dependencies: null,
        ...overrides
    }) as ReactFiber;
describe('selected component inspection contract', () => {
    it('marks a slot without recorded state unavailable instead of showing invented undefined', () => {
        const sections = getComponentStateSections(
            fiber({ memoizedState: { next: null } })
        );
        expect(
            sections.find((section) => section.name === 'hooks')?.fields[0]
                .value
        ).toMatchObject({
            _custom: { unavailable: true, display: '[Hook value not recorded]' }
        });
    });
    it('separates committed class state and contexts from hooks', () => {
        const sections = getComponentStateSections(
            fiber({
                tag: ReactFiberTag.ClassComponent,
                memoizedState: { count: 10 },
                stateNode: { state: { count: 99 } },
                dependencies: {
                    firstContext: {
                        context: { displayName: 'Theme' },
                        memoizedValue: 'observed',
                        next: null
                    }
                }
            })
        );
        expect(
            sections.find((section) => section.name === 'state')?.fields[0]
                .value
        ).toMatchObject({ _custom: { value: { count: 10 } } });
        expect(
            sections.find((section) => section.name === 'context')?.fields
        ).toEqual([{ name: 'Theme 0', value: 'observed' }]);
        expect(sections.some((section) => section.name === 'hooks')).toBe(
            false
        );
    });
    it('preserves null class state and does not walk it as a hook list', () => {
        expect(
            getHooks(
                fiber({
                    tag: ReactFiberTag.ClassComponent,
                    memoizedState: { next: { memoizedState: 123 } }
                })
            )
        ).toEqual([]);
        expect(
            getComponentStateSections(
                fiber({ tag: ReactFiberTag.ClassComponent })
            ).find((section) => section.name === 'state')?.fields[0].value
        ).toBeNull();
    });
    it('uses primitive debug metadata for nested hook slots, with honest production ambiguity', () => {
        const hook = {
            memoizedState: 6,
            queue: { lastRenderedReducer: function minified() {} },
            next: { memoizedState: { count: 3 }, queue: {}, next: null }
        };
        const target = fiber({ memoizedState: hook });
        Object.assign(target, {
            _debugHookTypes: ['useState', 'useContext', 'useReducer']
        });
        expect(getHooks(target).map((item) => item.type)).toEqual([
            'state',
            'reducer'
        ]);
        Object.assign(target, { _debugHookTypes: undefined });
        expect(getHooks(target).map((item) => item.type)).toEqual([
            'state-or-reducer',
            'state-or-reducer'
        ]);
        expect(
            getComponentStateSections(target).find(
                (section) => section.name === 'hooks'
            )?.notice
        ).toContain('Custom-hook and variable names are unavailable');
    });
    it('marks absent observed context unavailable instead of reading global defaults', () => {
        const sections = getComponentStateSections(
            fiber({
                dependencies: {
                    firstContext: {
                        context: {
                            displayName: 'Theme',
                            _currentValue: 'wrong'
                        },
                        next: null
                    }
                }
            })
        );
        expect(
            sections.find((section) => section.name === 'context')?.fields[0]
                .value
        ).toMatchObject({ _custom: { unavailable: true } });
        expect(
            getComponentStateSections(
                fiber({ tag: ReactFiberTag.ContextConsumer })
            )
        ).toContainEqual(
            expect.objectContaining({ name: 'context', status: 'unavailable' })
        );
        expect(
            getComponentStateSections(
                fiber({
                    tag: ReactFiberTag.ContextProvider,
                    memoizedProps: { value: 'provided' }
                })
            )
        ).toContainEqual(
            expect.objectContaining({
                name: 'context',
                fields: [{ name: 'Provided value', value: 'provided' }]
            })
        );
    });
    it('does not invoke getters and exposes unavailable and truncated values', () => {
        const getter = jest.fn(() => {
            throw Error('Do not run');
        });
        const props = Object.defineProperty(
            { list: Array.from({ length: 80 }, (_, i) => i) },
            'secret',
            { enumerable: true, get: getter }
        );
        const fields = getComponentStateSections(
            fiber({ memoizedProps: props })
        )[0].fields;
        expect(fields[0].value).toMatchObject({ _custom: { truncated: true } });
        expect(fields[1].value).toMatchObject({
            _custom: { unavailable: true }
        });
        expect(getter).not.toHaveBeenCalled();
        expect(
            getComponentStateSections(
                fiber({
                    memoizedProps: new Proxy(
                        {},
                        {
                            ownKeys() {
                                throw Error('unreadable');
                            }
                        }
                    )
                })
            )[0]
        ).toMatchObject({ status: 'unavailable' });
    });
    it('bounds total expansion and strings, handles cycles, aliases and unreadable objects', () => {
        const shared = { value: 1 };
        expect(formatDisplayableValue({ a: shared, b: shared })).toMatchObject({
            _custom: {
                value: {
                    a: { _custom: { type: 'object' } },
                    b: { _custom: { type: 'object' } }
                }
            }
        });
        expect(
            formatDisplayableValue('long', { maxStringLength: 2 })
        ).toMatchObject({ _custom: { display: 'lo', truncated: true } });
        expect(
            formatDisplayableValue({ a: { b: 1 } }, { maxNodes: 1 })
        ).toMatchObject({
            _custom: { value: { a: { _custom: { truncated: true } } } }
        });
        expect(
            formatDisplayableValue(
                new Proxy(
                    {},
                    {
                        getPrototypeOf() {
                            throw Error('unreadable');
                        }
                    }
                )
            )
        ).toMatchObject({ _custom: { unavailable: true } });
        expect(formatDisplayableValue(new Date('2026-01-02'))).toMatchObject({
            _custom: { type: 'date', display: '2026-01-02T00:00:00.000Z' }
        });
        expect(formatDisplayableValue(/x/gi)).toMatchObject({
            _custom: { type: 'regexp', display: '/x/gi' }
        });
        const object = JSON.parse('{"__proto__":{"polluted":true}}');
        expect(Object.prototype).not.toHaveProperty('polluted');
        expect(JSON.stringify(formatDisplayableValue(object))).toContain(
            '__proto__'
        );
    });
});
