import type { ComponentNode } from '@devtools/core/browser';
import type { ComponentTreeNode } from './tree';

export function filterComponentTree(
    nodes: ComponentTreeNode[],
    filter: string
): ComponentTreeNode[] {
    const query = filter.trim().toLowerCase();
    if (!query) return nodes;
    return nodes.flatMap((node) => {
        if (node.label.toLowerCase().includes(query)) return [node];
        const children = filterComponentTree(node.children ?? [], query);
        return children.length ? [{ ...node, children }] : [];
    });
}

export function createSessionComponentTree(
    components: ComponentNode[]
): ComponentTreeNode[] {
    const childIds = new Set(
        components.flatMap((node) =>
            (node.children ?? []).map((child) => child.id)
        )
    );
    const convert = (node: ComponentNode): ComponentTreeNode => ({
        id: node.id,
        rootId: node.rootId,
        label: node.displayName,
        type: node.type,
        source: node.source,
        children: node.children?.map(convert)
    });
    return components.filter((node) => !childIds.has(node.id)).map(convert);
}
