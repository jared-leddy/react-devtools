interface SerializedPayload {
    json: unknown;
}

const FUNCTION_SENTINEL = Symbol('function');

const SuperJSON = {
    deserialize<T = unknown>(payload: SerializedPayload): T {
        return revive(payload.json, new Map(), '$') as T;
    },
    serialize(payload: unknown): SerializedPayload {
        return { json: flatten(payload, new WeakMap(), '$') };
    }
};

export default SuperJSON;

function flatten(
    payload: unknown,
    seen: WeakMap<object, string>,
    path: string
): unknown {
    if (typeof payload === 'function') {
        return FUNCTION_SENTINEL;
    }

    if (payload === undefined) {
        return { type: 'Undefined' };
    }

    if (payload instanceof Map) {
        const existingPath = seen.get(payload);

        if (existingPath) {
            return { type: 'Ref', value: existingPath };
        }

        seen.set(payload, path);

        return {
            type: 'Map',
            value: Array.from(payload.entries()).map(([key, value], index) => [
                serializeCollectionItem(key, seen, `${path}.map.${index}.key`),
                serializeCollectionItem(
                    value,
                    seen,
                    `${path}.map.${index}.value`
                )
            ])
        };
    }

    if (payload instanceof Set) {
        const existingPath = seen.get(payload);

        if (existingPath) {
            return { type: 'Ref', value: existingPath };
        }

        seen.set(payload, path);

        return {
            type: 'Set',
            value: Array.from(payload.values()).map((value, index) =>
                serializeCollectionItem(value, seen, `${path}.${index}`)
            )
        };
    }

    if (payload instanceof Error) {
        const existingPath = seen.get(payload);

        if (existingPath) {
            return { type: 'Ref', value: existingPath };
        }

        seen.set(payload, path);

        return {
            message: payload.message,
            name: payload.name,
            type: 'Error'
        };
    }

    if (Array.isArray(payload)) {
        const existingPath = seen.get(payload);

        if (existingPath) {
            return { type: 'Ref', value: existingPath };
        }

        seen.set(payload, path);

        return payload.map((value, index) =>
            serializeCollectionItem(value, seen, `${path}.${index}`)
        );
    }

    if (payload && typeof payload === 'object') {
        const existingPath = seen.get(payload);

        if (existingPath) {
            return { type: 'Ref', value: existingPath };
        }

        seen.set(payload, path);

        return Object.fromEntries(
            Object.entries(payload).flatMap(([key, value]) => {
                const serializedValue = flatten(value, seen, `${path}.${key}`);

                if (serializedValue === FUNCTION_SENTINEL) {
                    return [];
                }

                return [[key, serializedValue]];
            })
        );
    }

    return payload;
}

function serializeCollectionItem(
    payload: unknown,
    seen: WeakMap<object, string>,
    path: string
): unknown {
    const serializedValue = flatten(payload, seen, path);

    return serializedValue === FUNCTION_SENTINEL
        ? { type: 'Undefined' }
        : serializedValue;
}

function revive(
    payload: unknown,
    revived: Map<string, unknown>,
    path: string
): unknown {
    if (Array.isArray(payload)) {
        const array: unknown[] = [];
        revived.set(path, array);

        payload.forEach((value, index) => {
            array[index] = revive(value, revived, `${path}.${index}`);
        });

        return array;
    }

    if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;

        if (record.type === 'Undefined') {
            return undefined;
        }

        if (record.type === 'Ref' && typeof record.value === 'string') {
            return revived.get(record.value);
        }

        if (record.type === 'Map' && Array.isArray(record.value)) {
            const map = new Map();
            revived.set(path, map);

            record.value.forEach((entry, index) => {
                const [key, value] = entry as [unknown, unknown];

                map.set(
                    revive(key, revived, `${path}.map.${index}.key`),
                    revive(value, revived, `${path}.map.${index}.value`)
                );
            });

            return map;
        }

        if (record.type === 'Set' && Array.isArray(record.value)) {
            const set = new Set();
            revived.set(path, set);

            record.value.forEach((value, index) => {
                set.add(revive(value, revived, `${path}.${index}`));
            });

            return set;
        }

        if (record.type === 'Error') {
            const error = new Error(String(record.message ?? ''));
            error.name = String(record.name ?? 'Error');
            revived.set(path, error);

            return error;
        }

        const object: Record<string, unknown> = {};
        revived.set(path, object);

        Object.entries(record).forEach(([key, value]) => {
            object[key] = revive(value, revived, `${path}.${key}`);
        });

        return object;
    }

    return payload;
}
