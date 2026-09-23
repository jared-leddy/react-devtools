import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    List,
    type ListImperativeAPI,
    type RowComponentProps
} from 'react-window';

export interface ComponentTreeNode {
    children?: ComponentTreeNode[];
    id: string;
    label: string;
    type?: string;
}

export interface VirtualizedComponentTreeProps {
    defaultExpandedIds?: string[];
    height?: number;
    initialSelectedId?: string;
    nodes: ComponentTreeNode[];
    overscanCount?: number;
    rowHeight?: number;
    scrollToId?: string;
}

interface FlattenedTreeNode {
    depth: number;
    hasChildren: boolean;
    node: ComponentTreeNode;
}

interface TreeRowProps {
    expandedIds: Set<string>;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    rows: FlattenedTreeNode[];
    selectedId: string;
}

const DEFAULT_ROW_HEIGHT = 30;
const DEFAULT_TREE_HEIGHT = 360;

export function VirtualizedComponentTree({
    defaultExpandedIds,
    height = DEFAULT_TREE_HEIGHT,
    initialSelectedId,
    nodes,
    overscanCount = 6,
    rowHeight = DEFAULT_ROW_HEIGHT,
    scrollToId
}: VirtualizedComponentTreeProps) {
    const listRef = useRef<ListImperativeAPI | null>(null);
    const computedDefaultExpandedIds = useMemo(
        () => defaultExpandedIds ?? collectExpandableIds(nodes),
        [defaultExpandedIds, nodes]
    );
    const [expandedIds, setExpandedIds] = useState(
        () => new Set(computedDefaultExpandedIds)
    );
    const [selectedId, setSelectedId] = useState(
        () => initialSelectedId ?? findFirstNodeId(nodes) ?? ''
    );
    const rows = useMemo(
        () => flattenTree(nodes, expandedIds),
        [expandedIds, nodes]
    );
    const selectedIndex = rows.findIndex((row) => row.node.id === selectedId);
    const requestedScrollIndex = rows.findIndex(
        (row) => row.node.id === scrollToId
    );

    useEffect(() => {
        if (requestedScrollIndex >= 0) {
            listRef.current?.scrollToRow({
                align: 'center',
                index: requestedScrollIndex
            });
        }
    }, [listRef, requestedScrollIndex]);

    const toggleNode = useCallback((id: string) => {
        setExpandedIds((currentIds) => {
            const nextIds = new Set(currentIds);

            if (nextIds.has(id)) {
                nextIds.delete(id);
            } else {
                nextIds.add(id);
            }

            return nextIds;
        });
    }, []);

    const rowKey = useCallback(
        (index: number, data: TreeRowProps) =>
            data.rows[index]?.node.id ?? index,
        []
    );

    return (
        <div className="dt-components-tree">
            <div className="dt-components-tree__summary">
                <span>{rows.length} visible nodes</span>
                <span>
                    {selectedIndex >= 0 ? selectedIndex + 1 : 0} selected
                </span>
            </div>
            <List
                aria-label="Virtualized component tree"
                className="dt-components-tree__list"
                defaultHeight={height}
                listRef={listRef}
                overscanCount={overscanCount}
                rowComponent={TreeRow}
                rowCount={rows.length}
                rowHeight={rowHeight}
                rowKey={rowKey}
                rowProps={{
                    expandedIds,
                    onSelect: setSelectedId,
                    onToggle: toggleNode,
                    rows,
                    selectedId
                }}
                style={{ height }}
            />
        </div>
    );
}

export function generateSyntheticComponentTree(
    groupCount = 24,
    childrenPerGroup = 24
): ComponentTreeNode[] {
    return Array.from({ length: groupCount }, (_, groupIndex) => ({
        id: `component-group-${groupIndex}`,
        label: `ComponentGroup${groupIndex}`,
        type: 'section',
        children: Array.from({ length: childrenPerGroup }, (_, childIndex) => ({
            id: `component-group-${groupIndex}-child-${childIndex}`,
            label: `ComponentLeaf${groupIndex}_${childIndex}`,
            type: childIndex % 3 === 0 ? 'memo' : 'function'
        }))
    }));
}

export function collectExpandableIds(nodes: ComponentTreeNode[]): string[] {
    const expandableIds: string[] = [];

    for (const node of nodes) {
        if (node.children?.length) {
            expandableIds.push(node.id);
            expandableIds.push(...collectExpandableIds(node.children));
        }
    }

    return expandableIds;
}

function TreeRow({
    ariaAttributes,
    expandedIds,
    index,
    onSelect,
    onToggle,
    rows,
    selectedId,
    style
}: RowComponentProps<TreeRowProps>) {
    const row = rows[index];

    if (!row) {
        return null;
    }

    const isExpanded = expandedIds.has(row.node.id);
    const isSelected = row.node.id === selectedId;

    return (
        <div
            {...ariaAttributes}
            aria-expanded={row.hasChildren ? isExpanded : undefined}
            aria-level={row.depth + 1}
            aria-selected={isSelected}
            className={`dt-components-tree__row${
                isSelected ? ' dt-components-tree__row--selected' : ''
            }`}
            data-node-id={row.node.id}
            style={style}
        >
            <button
                aria-label={
                    row.hasChildren
                        ? `${isExpanded ? 'Collapse' : 'Expand'} ${
                              row.node.label
                          }`
                        : undefined
                }
                className="dt-components-tree__toggle"
                disabled={!row.hasChildren}
                onClick={() => {
                    onToggle(row.node.id);
                }}
                style={{ '--dt-tree-depth': row.depth } as CSSProperties}
                type="button"
            >
                {row.hasChildren ? (isExpanded ? 'v' : '>') : ''}
            </button>
            <button
                className="dt-components-tree__node"
                onClick={() => {
                    onSelect(row.node.id);
                }}
                type="button"
            >
                <span className="dt-components-tree__label">
                    {row.node.label}
                </span>
                {row.node.type ? (
                    <span className="dt-components-tree__type">
                        {row.node.type}
                    </span>
                ) : null}
            </button>
        </div>
    );
}

function flattenTree(
    nodes: ComponentTreeNode[],
    expandedIds: Set<string>,
    depth = 0
): FlattenedTreeNode[] {
    const rows: FlattenedTreeNode[] = [];

    for (const node of nodes) {
        const hasChildren = Boolean(node.children?.length);
        rows.push({ depth, hasChildren, node });

        if (hasChildren && expandedIds.has(node.id)) {
            rows.push(
                ...flattenTree(node.children ?? [], expandedIds, depth + 1)
            );
        }
    }

    return rows;
}

function findFirstNodeId(nodes: ComponentTreeNode[]): string | undefined {
    return nodes[0]?.id;
}
