import type { ComponentTreeNode } from '../fiberWalker.js';

export type ComponentFilterPredicate = (node: ComponentTreeNode) => boolean;

export interface ComponentFilterOptions {
    includeAncestors?: boolean;
}

export function createComponentFilter(
    query: null | string | undefined
): ComponentFilterPredicate {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return () => true;
    }

    return (node) =>
        normalizeQuery(node.name).includes(normalizedQuery) ||
        normalizeQuery(node.displayName).includes(normalizedQuery) ||
        normalizeQuery(node.fiberTag).includes(normalizedQuery) ||
        normalizeQuery(node.type).includes(normalizedQuery) ||
        node.tags.some((tag) => normalizeQuery(tag).includes(normalizedQuery));
}

export function filterComponentTree(
    nodes: ComponentTreeNode[],
    filter: ComponentFilterPredicate | null | string | undefined,
    options: ComponentFilterOptions = {}
): ComponentTreeNode[] {
    const predicate =
        typeof filter === 'function' ? filter : createComponentFilter(filter);
    const includeAncestors = options.includeAncestors ?? true;

    return nodes.flatMap((node) =>
        filterComponentTreeNode(node, predicate, includeAncestors)
    );
}

function filterComponentTreeNode(
    node: ComponentTreeNode,
    predicate: ComponentFilterPredicate,
    includeAncestors: boolean
): ComponentTreeNode[] {
    const filteredChildren = node.children.flatMap((child) =>
        filterComponentTreeNode(child, predicate, includeAncestors)
    );
    const isMatch = predicate(node);

    if (isMatch) {
        const children = includeAncestors
            ? filteredChildren
            : filterComponentTree(node.children, predicate, {
                  includeAncestors
              });

        return [
            {
                ...node,
                children,
                hasChildren: children.length > 0
            }
        ];
    }

    if (includeAncestors && filteredChildren.length > 0) {
        return [
            {
                ...node,
                children: filteredChildren,
                hasChildren: true
            }
        ];
    }

    return includeAncestors ? [] : filteredChildren;
}

function normalizeQuery(value: null | string | undefined): string {
    return (value ?? '').trim().toLocaleLowerCase();
}
