export interface DisplayableValueOptions {
    maxDepth?: number;
    maxEntries?: number;
    maxNodes?: number;
    maxStringLength?: number;
}

export type DisplayableValue =
    boolean | DisplayableCustomValue | null | number | string;

export interface DisplayableCustomValue {
    _custom: {
        display: string;
        preview?: string;
        readOnly?: boolean;
        type: string;
        truncated?: boolean;
        unavailable?: boolean;
        value?: DisplayableValue | DisplayableValueMap | DisplayableValue[];
    };
}

export type DisplayableValueMap = Record<string, DisplayableValue>;

interface FormatContext {
    maxDepth: number;
    maxEntries: number;
    seen: WeakSet<object>;
    remaining: number;
    maxStringLength: number;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_ENTRIES = 50;

export function formatDisplayableValue(
    value: unknown,
    options: DisplayableValueOptions = {}
): DisplayableValue {
    return createDisplayableValueFormatter(options)(value);
}

export function createDisplayableValueFormatter(
    options: DisplayableValueOptions = {}
): (value: unknown) => DisplayableValue {
    const context: FormatContext = {
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        maxEntries: options.maxEntries ?? DEFAULT_MAX_ENTRIES,
        remaining: options.maxNodes ?? 500,
        maxStringLength: options.maxStringLength ?? 10000,
        seen: new WeakSet<object>()
    };
    return (value) => formatValue(value, context);
}

function formatValue(
    value: unknown,
    context: FormatContext,
    depth = 0
): DisplayableValue {
    if (--context.remaining < 0)
        return {
            _custom: {
                type: 'truncated',
                display: '[Value budget exceeded]',
                truncated: true,
                readOnly: true
            }
        };
    const alreadySeen =
        typeof value === 'object' && value !== null && context.seen.has(value);
    try {
        return formatValueUnsafe(value, context, depth);
    } catch {
        return unavailableValue();
    } finally {
        if (typeof value === 'object' && value !== null && !alreadySeen)
            context.seen.delete(value);
    }
}

export function unavailableValue(
    display = '[Property unavailable]'
): DisplayableCustomValue {
    return {
        _custom: {
            type: 'unavailable',
            display,
            unavailable: true,
            readOnly: true
        }
    };
}

function formatValueUnsafe(
    value: unknown,
    context: FormatContext,
    depth = 0
): DisplayableValue {
    if (typeof value === 'string' && value.length > context.maxStringLength) {
        return {
            _custom: {
                type: 'string',
                display: value.slice(0, context.maxStringLength),
                truncated: true,
                readOnly: true
            }
        };
    }
    if (value === null || typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? value
            : createCustom('number', String(value));
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'bigint') {
        return createCustom('bigint', `${String(value)}n`);
    }

    if (typeof value === 'undefined') {
        return createCustom('undefined', 'undefined');
    }

    if (typeof value === 'symbol') {
        return createCustom('symbol', String(value));
    }

    if (typeof value === 'function') {
        return createCustom(
            'function',
            getFunctionDisplayName(value),
            undefined,
            true
        );
    }

    if (!isObject(value)) {
        return createCustom(typeof value, String(value));
    }

    if (context.seen.has(value)) {
        return createCustom('circular', '[Circular]');
    }

    if (depth >= context.maxDepth) {
        return {
            _custom: {
                type: getObjectTypeName(value),
                display: '[MaxDepth]',
                truncated: true,
                readOnly: true
            }
        };
    }

    if (isDomNodeLike(value)) {
        return createCustom(
            'dom-node',
            getDomNodeDisplayName(value),
            undefined,
            true
        );
    }

    context.seen.add(value);
    if (value instanceof Date)
        return createCustom(
            'date',
            Number.isNaN(Date.prototype.getTime.call(value))
                ? 'Invalid Date'
                : Date.prototype.toISOString.call(value)
        );
    if (value instanceof RegExp)
        return createCustom('regexp', RegExp.prototype.toString.call(value));

    if (Array.isArray(value)) {
        const result = createCustom(
            'array',
            `Array(${value.length})`,
            formatArray(value, context, depth + 1)
        );
        if (value.length > context.maxEntries) result._custom.truncated = true;
        return result;
    }

    if (value instanceof Map) {
        const result = createCustom(
            'map',
            `Map(${value.size})`,
            formatMap(value, context, depth + 1)
        );
        if (value.size > context.maxEntries) result._custom.truncated = true;
        return result;
    }

    if (value instanceof Set) {
        const result = createCustom(
            'set',
            `Set(${value.size})`,
            formatSet(value, context, depth + 1)
        );
        if (value.size > context.maxEntries) result._custom.truncated = true;
        return result;
    }

    if (isPlainObject(value)) {
        const result = createCustom(
            'object',
            'Object',
            formatObject(value as Record<string, unknown>, context, depth + 1)
        );
        if (Object.keys(value).length > context.maxEntries)
            result._custom.truncated = true;
        return result;
    }

    const result = createCustom(
        'instance',
        getObjectTypeName(value),
        formatObject(value as Record<string, unknown>, context, depth + 1)
    );
    if (Object.keys(value).length > context.maxEntries)
        result._custom.truncated = true;
    return result;
}

function formatArray(
    value: unknown[],
    context: FormatContext,
    depth: number
): DisplayableValue[] {
    return Array.from(
        { length: Math.min(value.length, context.maxEntries) },
        (_item, index) => formatProperty(value, String(index), context, depth)
    );
}

function formatMap(
    value: Map<unknown, unknown>,
    context: FormatContext,
    depth: number
): DisplayableValue[] {
    const entries: DisplayableValue[] = [];
    let index = 0;

    for (const [key, item] of value) {
        if (index >= context.maxEntries) {
            break;
        }

        entries.push(
            createCustom('map-entry', `Entry ${index}`, [
                formatValue(key, context, depth),
                formatValue(item, context, depth)
            ])
        );
        index += 1;
    }

    return entries;
}

function formatSet(
    value: Set<unknown>,
    context: FormatContext,
    depth: number
): DisplayableValue[] {
    const entries: DisplayableValue[] = [];
    let index = 0;

    for (const item of value) {
        if (index >= context.maxEntries) {
            break;
        }

        entries.push(formatValue(item, context, depth));
        index += 1;
    }

    return entries;
}

function formatObject(
    value: Record<string, unknown>,
    context: FormatContext,
    depth: number
): DisplayableValueMap {
    const result: DisplayableValueMap = Object.create(null);
    const keys = Object.keys(value).slice(0, context.maxEntries);

    for (const key of keys) {
        result[key] = formatProperty(value, key, context, depth);
    }

    return result;
}

function formatProperty(
    value: object,
    key: string,
    context: FormatContext,
    depth: number
): DisplayableValue {
    try {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor && 'value' in descriptor
            ? formatValue(descriptor.value, context, depth)
            : unavailableValue('[Accessor not evaluated]');
    } catch {
        return unavailableValue();
    }
}

function createCustom(
    type: string,
    display: string,
    value?: DisplayableCustomValue['_custom']['value'],
    readOnly?: boolean
): DisplayableCustomValue {
    return {
        _custom: {
            display,
            ...(readOnly === true ? { readOnly } : {}),
            type,
            ...(value === undefined ? {} : { value })
        }
    };
}

function getFunctionDisplayName(value: { name?: string }): string {
    const name = Object.getOwnPropertyDescriptor(value, 'name')?.value;
    return typeof name === 'string' && name ? `ƒ ${name}()` : 'ƒ anonymous()';
}

function getDomNodeDisplayName(value: Record<PropertyKey, unknown>): string {
    const tagName = typeof value.tagName === 'string' ? value.tagName : 'node';
    return `<${tagName.toLowerCase()}>`;
}

function getObjectTypeName(value: object): string {
    const prototype = Object.getPrototypeOf(value);
    const constructor =
        prototype &&
        Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
    return typeof constructor === 'function'
        ? Object.getOwnPropertyDescriptor(constructor, 'name')?.value ||
              'Object'
        : 'Object';
}

function isDomNodeLike(
    value: Record<PropertyKey, unknown>
): value is Record<PropertyKey, unknown> & { nodeType: number } {
    return (
        typeof Object.getOwnPropertyDescriptor(value, 'nodeType')?.value ===
            'number' &&
        (typeof Object.getOwnPropertyDescriptor(value, 'nodeName')?.value ===
            'string' ||
            typeof Object.getOwnPropertyDescriptor(value, 'tagName')?.value ===
                'string')
    );
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
