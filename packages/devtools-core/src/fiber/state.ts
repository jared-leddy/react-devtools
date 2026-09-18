import type { ReactFiber } from '../fiber.js';
import type { ComponentStateSection } from '../types.js';

export interface FiberPropsOptions {
    includeChildren?: boolean;
}

export type FiberPropsRecord = Record<string, unknown>;

export function getProps(
    fiber: ReactFiber,
    options: FiberPropsOptions = {}
): FiberPropsRecord {
    const props = getPropsRecord(fiber.memoizedProps);

    if (!props) {
        return {};
    }

    const includeChildren = options.includeChildren ?? false;
    const entries = Object.entries(props).filter(
        ([key]) => includeChildren || key !== 'children'
    );

    return Object.fromEntries(entries);
}

export function getPropsStateSection(
    fiber: ReactFiber,
    options: FiberPropsOptions = {}
): ComponentStateSection {
    return {
        fields: Object.entries(getProps(fiber, options)).map(
            ([name, value]) => ({
                name,
                value
            })
        ),
        name: 'props'
    };
}

function getPropsRecord(value: unknown): null | Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
