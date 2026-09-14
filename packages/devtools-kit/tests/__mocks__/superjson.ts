interface SerializedPayload {
    json: unknown;
}

const SuperJSON = {
    deserialize<T = unknown>(payload: SerializedPayload): T {
        return revive(payload.json) as T;
    },
    serialize(payload: unknown): SerializedPayload {
        return { json: flatten(payload) };
    }
};

export default SuperJSON;

function flatten(payload: unknown): unknown {
    if (payload instanceof Map) {
        return {
            type: 'Map',
            value: Array.from(payload.entries()).map(([key, value]) => [
                flatten(key),
                flatten(value)
            ])
        };
    }

    if (payload instanceof Set) {
        return {
            type: 'Set',
            value: Array.from(payload.values()).map((value) => flatten(value))
        };
    }

    if (payload instanceof Error) {
        return {
            message: payload.message,
            name: payload.name,
            type: 'Error'
        };
    }

    if (Array.isArray(payload)) {
        return payload.map((value) => flatten(value));
    }

    if (payload && typeof payload === 'object') {
        return Object.fromEntries(
            Object.entries(payload).map(([key, value]) => [key, flatten(value)])
        );
    }

    return payload;
}

function revive(payload: unknown): unknown {
    if (Array.isArray(payload)) {
        return payload.map((value) => revive(value));
    }

    if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;

        if (record.type === 'Map' && Array.isArray(record.value)) {
            return new Map(
                record.value.map((entry) => {
                    const [key, value] = entry as [unknown, unknown];

                    return [revive(key), revive(value)];
                })
            );
        }

        if (record.type === 'Set' && Array.isArray(record.value)) {
            return new Set(record.value.map((value) => revive(value)));
        }

        if (record.type === 'Error') {
            const error = new Error(String(record.message ?? ''));
            error.name = String(record.name ?? 'Error');

            return error;
        }

        return Object.fromEntries(
            Object.entries(record).map(([key, value]) => [key, revive(value)])
        );
    }

    return payload;
}
