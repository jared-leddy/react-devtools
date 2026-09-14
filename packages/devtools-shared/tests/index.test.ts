import {
    DEVTOOLS_SHARED_PACKAGE_NAME,
    deepClone,
    generateId,
    getTargetObject,
    isFunction,
    isObjectLike,
    isPlainObject,
    isRecord
} from '../src/index.js';

describe('@devtools/shared', () => {
    it('imports the package entry point without throwing', () => {
        expect(DEVTOOLS_SHARED_PACKAGE_NAME).toBe('@devtools/shared');
    });
});

describe('getTargetObject', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(
        globalThis,
        'window'
    );
    const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
    const originalGlobal = Object.getOwnPropertyDescriptor(
        globalThis,
        'global'
    );

    afterEach(() => {
        restoreGlobalProperty('window', originalWindow);
        restoreGlobalProperty('self', originalSelf);
        restoreGlobalProperty('global', originalGlobal);
    });

    it('returns window in a page-like context', () => {
        const pageWindow = { label: 'window' };
        Object.defineProperty(pageWindow, 'window', {
            value: pageWindow
        });
        setGlobalProperty('window', pageWindow);
        setGlobalProperty('self', { label: 'self' });
        setGlobalProperty('global', { label: 'global' });

        expect(getTargetObject()).toBe(pageWindow);
    });

    it('returns self in an extension worker-like context', () => {
        const workerSelf = { label: 'self' };
        setGlobalProperty('window', undefined);
        setGlobalProperty('self', workerSelf);
        setGlobalProperty('global', { label: 'global' });

        expect(getTargetObject()).toBe(workerSelf);
    });

    it('returns global in a Node-like context', () => {
        const nodeGlobal = { label: 'global' };
        setGlobalProperty('window', undefined);
        setGlobalProperty('self', undefined);
        setGlobalProperty('global', nodeGlobal);

        expect(getTargetObject()).toBe(nodeGlobal);
    });

    it('falls back to globalThis', () => {
        setGlobalProperty('window', undefined);
        setGlobalProperty('self', undefined);
        setGlobalProperty('global', undefined);

        expect(getTargetObject()).toBe(globalThis);
    });
});

describe('generateId', () => {
    it('produces unique ids across many calls', () => {
        const ids = Array.from({ length: 1_000 }, () => generateId('test'));

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => id.startsWith('test_'))).toBe(true);
    });
});

describe('deepClone', () => {
    it('returns primitives without wrapping them', () => {
        expect(deepClone(null)).toBeNull();
        expect(deepClone('value')).toBe('value');
        expect(deepClone(42)).toBe(42);
    });

    it('clones nested objects, arrays, maps, and sets', () => {
        const mapKey = { id: 'key' };
        const source = {
            array: [{ count: 1 }],
            map: new Map([[mapKey, { enabled: true }]]),
            set: new Set([{ label: 'item' }])
        };

        const clone = deepClone(source);

        expect(clone).toEqual(source);
        expect(clone).not.toBe(source);
        expect(clone.array).not.toBe(source.array);
        expect(clone.array[0]).not.toBe(source.array[0]);
        expect(clone.map).not.toBe(source.map);
        expect([...clone.map.keys()][0]).not.toBe(mapKey);
        expect([...clone.map.values()][0]).not.toBe(
            [...source.map.values()][0]
        );
        expect(clone.set).not.toBe(source.set);
        expect([...clone.set][0]).not.toBe([...source.set][0]);
    });

    it('clones dates, regexps, symbols, descriptors, and cycles', () => {
        const symbolKey = Symbol('secret');
        const source: {
            createdAt: Date;
            pattern: RegExp;
            self?: unknown;
            readonlyValue?: string;
            [symbolKey]: { nested: boolean };
        } = {
            createdAt: new Date('2026-09-14T00:00:00.000Z'),
            pattern: /devtools/gi,
            [symbolKey]: { nested: true }
        };
        source.pattern.lastIndex = 3;
        source.self = source;
        Object.defineProperty(source, 'readonlyValue', {
            value: 'locked',
            enumerable: true,
            writable: false
        });

        const clone = deepClone(source);
        const descriptor = Object.getOwnPropertyDescriptor(
            clone,
            'readonlyValue'
        );

        expect(clone).not.toBe(source);
        expect(clone.self).toBe(clone);
        expect(clone.createdAt).not.toBe(source.createdAt);
        expect(clone.createdAt.getTime()).toBe(source.createdAt.getTime());
        expect(clone.pattern).not.toBe(source.pattern);
        expect(clone.pattern.source).toBe(source.pattern.source);
        expect(clone.pattern.flags).toBe(source.pattern.flags);
        expect(clone.pattern.lastIndex).toBe(source.pattern.lastIndex);
        expect(clone[symbolKey]).toEqual({ nested: true });
        expect(clone[symbolKey]).not.toBe(source[symbolKey]);
        expect(descriptor?.writable).toBe(false);
    });
});

describe('type guards', () => {
    it('checks object-like values', () => {
        expect(isObjectLike({})).toBe(true);
        expect(isObjectLike([])).toBe(true);
        expect(isObjectLike(null)).toBe(false);
        expect(isObjectLike('value')).toBe(false);
    });

    it('checks callable values', () => {
        expect(isFunction(() => undefined)).toBe(true);
        expect(isFunction({})).toBe(false);
    });

    it('checks records and plain objects', () => {
        expect(isRecord({ value: true })).toBe(true);
        expect(isRecord([])).toBe(false);
        expect(isPlainObject({ value: true })).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(new Date())).toBe(false);
    });
});

function setGlobalProperty(key: string, value: unknown) {
    Object.defineProperty(globalThis, key, {
        configurable: true,
        value,
        writable: true
    });
}

function restoreGlobalProperty(
    key: string,
    descriptor: PropertyDescriptor | undefined
) {
    if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);

        return;
    }

    Reflect.deleteProperty(globalThis, key);
}
