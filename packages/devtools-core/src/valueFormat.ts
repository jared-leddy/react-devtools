export interface DisplayableValueOptions {
    maxDepth?: number;
    maxEntries?: number;
}

export type DisplayableValue =
    boolean | DisplayableCustomValue | null | number | string;

export interface DisplayableCustomValue {
    _custom: {
        display: string;
        preview?: string;
        readOnly?: boolean;
        type: string;
        value?: DisplayableValue | DisplayableValueMap | DisplayableValue[];
    };
}

export type DisplayableValueMap = Record<string, DisplayableValue>;

interface FormatContext {
    maxDepth: number;
    maxEntries: number;
    seen: WeakSet<object>;
}

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_ENTRIES = 50;

export function formatDisplayableValue(
    value: unknown,
    options: DisplayableValueOptions = {}
): DisplayableValue {
    return formatValue(value, {
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        maxEntries: options.maxEntries ?? DEFAULT_MAX_ENTRIES,
        seen: new WeakSet<object>()
    });
}

function formatValue(
    value: unknown,
    context: FormatContext,
    depth = 0
): DisplayableValue {
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
        return createCustom(getObjectTypeName(value), '[MaxDepth]');
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

    if (Array.isArray(value)) {
        return createCustom(
            'array',
            `Array(${value.length})`,
            formatArray(value, context, depth + 1)
        );
    }

    if (value instanceof Map) {
        return createCustom(
            'map',
            `Map(${value.size})`,
            formatMap(value, context, depth + 1)
        );
    }

    if (value instanceof Set) {
        return createCustom(
            'set',
            `Set(${value.size})`,
            formatSet(value, context, depth + 1)
        );
    }

    if (isPlainObject(value)) {
        return createCustom(
            'object',
            'Object',
            formatObject(value as Record<string, unknown>, context, depth + 1)
        );
    }

    return createCustom(
        'instance',
        getObjectTypeName(value),
        formatObject(value as Record<string, unknown>, context, depth + 1)
    );
}

function formatArray(
    value: unknown[],
    context: FormatContext,
    depth: number
): DisplayableValue[] {
    return value
        .slice(0, context.maxEntries)
        .map((item) => formatValue(item, context, depth));
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
    const result: DisplayableValueMap = {};
    const keys = Object.keys(value).slice(0, context.maxEntries);

    for (const key of keys) {
        result[key] = formatValue(value[key], context, depth);
    }

    return result;
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
    return value.name ? `ƒ ${value.name}()` : 'ƒ anonymous()';
}

function getDomNodeDisplayName(value: Record<PropertyKey, unknown>): string {
    const tagName = typeof value.tagName === 'string' ? value.tagName : 'node';
    return `<${tagName.toLowerCase()}>`;
}

function getObjectTypeName(value: object): string {
    return value.constructor?.name || 'Object';
}

function isDomNodeLike(
    value: Record<PropertyKey, unknown>
): value is Record<PropertyKey, unknown> & { nodeType: number } {
    return (
        typeof value.nodeType === 'number' &&
        (typeof value.nodeName === 'string' ||
            typeof value.tagName === 'string')
    );
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
