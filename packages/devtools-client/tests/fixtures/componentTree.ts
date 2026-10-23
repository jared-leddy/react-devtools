import type { ComponentTreeNode } from '../../src/components/tree';
import type {
    StateViewerSection,
    StateViewerValue
} from '../../src/components/state';

export function generateSyntheticComponentTree(
    groupCount = 24,
    childrenPerGroup = 24
): ComponentTreeNode[] {
    return Array.from({ length: groupCount }, (_, groupIndex) => ({
        id: `component-group-${groupIndex}`,
        label: `ComponentGroup${groupIndex}`,
        rootId: 'synthetic-root',
        stateSections: createSyntheticStateSections(groupIndex),
        tags: ['root'],
        type: 'section',
        children: Array.from({ length: childrenPerGroup }, (_, childIndex) => ({
            elementId: `element-${groupIndex}-${childIndex}`,
            id: `component-group-${groupIndex}-child-${childIndex}`,
            label: `ComponentLeaf${groupIndex}_${childIndex}`,
            rootId: 'synthetic-root',
            stateSections: createSyntheticStateSections(groupIndex, childIndex),
            tags:
                childIndex % 5 === 0
                    ? ['memoized', 'interactive']
                    : ['rendered'],
            type: childIndex % 3 === 0 ? 'memo' : 'function'
        }))
    }));
}

function createSyntheticStateSections(
    groupIndex: number,
    childIndex?: number
): StateViewerSection[] {
    const componentLabel =
        childIndex === undefined
            ? `ComponentGroup${groupIndex}`
            : `ComponentLeaf${groupIndex}_${childIndex}`;
    const ordinal = childIndex ?? groupIndex;
    const componentId =
        childIndex === undefined
            ? `component-group-${groupIndex}`
            : `component-group-${groupIndex}-child-${childIndex}`;

    return [
        {
            fields: [
                { name: 'label', value: componentLabel },
                { name: 'enabled', value: ordinal % 2 === 0 },
                {
                    name: 'metadata',
                    value: createCustomValue('object', 'Object', {
                        owner: `Root ${groupIndex}`,
                        priority: ordinal % 3,
                        tags: createCustomValue('array', 'Array(2)', [
                            'synthetic',
                            childIndex === undefined ? 'group' : 'leaf'
                        ])
                    })
                },
                {
                    name: 'onSelect',
                    value: createCustomValue(
                        'function',
                        `ƒ handle${componentLabel}Select()`,
                        undefined,
                        true
                    )
                },
                {
                    name: 'hostNode',
                    value: createCustomValue(
                        'dom-node',
                        '<div>',
                        undefined,
                        true
                    )
                }
            ],
            name: 'props'
        },
        {
            fields: [
                {
                    name: 'Hook 0 (state)',
                    value: createCustomValue('object', 'Object', {
                        count: ordinal,
                        selected: childIndex === 0
                    })
                },
                {
                    name: 'Hook 1 (memo)',
                    value: createCustomValue('map', 'Map(2)', [
                        createCustomValue('map-entry', 'Entry 0', [
                            'componentId',
                            componentId
                        ]),
                        createCustomValue('map-entry', 'Entry 1', [
                            'renderCost',
                            `${ordinal + 1}ms`
                        ])
                    ])
                },
                {
                    name: 'Hook 2 (ref)',
                    value: createCustomValue('set', 'Set(2)', [
                        'mounted',
                        childIndex === undefined ? 'section' : 'function'
                    ])
                }
            ],
            name: 'hooks'
        }
    ];
}

function createCustomValue(
    type: string,
    display: string,
    value?:
        | StateViewerValue
        | StateViewerValue[]
        | Record<string, StateViewerValue>,
    readOnly?: boolean
): StateViewerValue {
    return {
        _custom: {
            display,
            ...(readOnly === true ? { readOnly } : {}),
            type,
            ...(value === undefined ? {} : { value })
        }
    };
}
