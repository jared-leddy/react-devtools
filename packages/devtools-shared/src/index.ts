export type TargetObject = typeof globalThis;

let idCounter = 0;

export const DEVTOOLS_SHARED_PACKAGE_NAME = '@devtools/shared';

export function getTargetObject(): TargetObject {
    const target = globalThis as TargetObject & {
        global?: TargetObject;
        self?: TargetObject;
        window?: TargetObject & { window?: unknown };
    };

    if (typeof target.window === 'object' && target.window) {
        const windowTarget = target.window;

        if (windowTarget.window === windowTarget) {
            return windowTarget;
        }
    }

    if (typeof target.self === 'object' && target.self) {
        return target.self;
    }

    if (typeof target.global === 'object' && target.global) {
        return target.global;
    }

    return globalThis;
}

export function generateId(prefix = 'devtools'): string {
    idCounter += 1;

    const timestamp = Date.now().toString(36);
    const random =
        typeof crypto === 'object' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().replaceAll('-', '')
            : Math.random().toString(36).slice(2);

    return `${prefix}_${timestamp}_${idCounter.toString(36)}_${random}`;
}

export function isObjectLike(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

export function isFunction(
    value: unknown
): value is (...args: never[]) => unknown {
    return typeof value === 'function';
}

export function isRecord(
    value: unknown
): value is Record<PropertyKey, unknown> {
    return isObjectLike(value) && !Array.isArray(value);
}

export function isPlainObject(
    value: unknown
): value is Record<PropertyKey, unknown> {
    if (!isRecord(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

export function deepClone<T>(value: T): T {
    return cloneValue(value, new WeakMap<object, unknown>()) as T;
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
    if (!isObjectLike(value)) {
        return value;
    }

    const existing = seen.get(value);

    if (existing) {
        return existing;
    }

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (value instanceof RegExp) {
        const clone = new RegExp(value.source, value.flags);
        clone.lastIndex = value.lastIndex;

        return clone;
    }

    if (Array.isArray(value)) {
        const clone: unknown[] = [];
        seen.set(value, clone);

        for (const item of value) {
            clone.push(cloneValue(item, seen));
        }

        return clone;
    }

    if (value instanceof Map) {
        const clone = new Map<unknown, unknown>();
        seen.set(value, clone);

        for (const [key, item] of value.entries()) {
            clone.set(cloneValue(key, seen), cloneValue(item, seen));
        }

        return clone;
    }

    if (value instanceof Set) {
        const clone = new Set<unknown>();
        seen.set(value, clone);

        for (const item of value.values()) {
            clone.add(cloneValue(item, seen));
        }

        return clone;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;
    const clone = Object.create(prototype) as Record<PropertyKey, unknown>;
    seen.set(value, clone);

    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);

        if (!descriptor) {
            continue;
        }

        if ('value' in descriptor) {
            descriptor.value = cloneValue(descriptor.value, seen);
        }

        Object.defineProperty(clone, key, descriptor);
    }

    return clone;
}
