import {
    createComponentFilter,
    filterComponentTree
} from '../src/fiber/filter.js';
import type { ComponentTreeNode } from '../src/index.js';

describe('fiber component tree filters', () => {
    it('matches component names while preserving visible ancestors', () => {
        const filtered = filterComponentTree(
            createKnownComponentTree(),
            'lazy'
        );

        expect(summarizeTree(filtered)).toEqual([
            {
                children: [
                    {
                        children: [{ children: [], name: 'LazyPanel' }],
                        name: 'Suspense'
                    }
                ],
                name: 'App'
            }
        ]);
    });

    it('matches assigned tags without leaking unrelated descendants', () => {
        const filtered = filterComponentTree(
            createKnownComponentTree(),
            'suspense'
        );

        expect(summarizeTree(filtered)).toEqual([
            {
                children: [{ children: [], name: 'Suspense' }],
                name: 'App'
            }
        ]);
    });

    it('can return only the matching nodes when ancestors are not requested', () => {
        const filtered = filterComponentTree(
            createKnownComponentTree(),
            'panel',
            {
                includeAncestors: false
            }
        );

        expect(summarizeTree(filtered)).toEqual([
            { children: [], name: 'HeaderPanel' },
            { children: [], name: 'MemoPanel' },
            { children: [], name: 'LazyPanel' }
        ]);
    });

    it('creates predicates that match names, display names, fiber tags, types, and tags', () => {
        const suspense = createComponentNode({
            displayName: 'Suspense',
            fiberTag: 'Suspense',
            name: 'Suspense',
            tags: ['Suspense', 'boundary', 'suspense'],
            type: 'suspense'
        });

        expect(createComponentFilter('boundary')(suspense)).toBe(true);
        expect(createComponentFilter('SUSPENSE')(suspense)).toBe(true);
        expect(createComponentFilter('missing')(suspense)).toBe(false);
        expect(createComponentFilter('')(suspense)).toBe(true);
        expect(createComponentFilter('   ')(suspense)).toBe(true);
    });
});

function createKnownComponentTree(): ComponentTreeNode[] {
    return [
        createComponentNode({
            children: [
                createComponentNode({
                    fiberTag: 'FunctionComponent',
                    name: 'HeaderPanel',
                    tags: ['FunctionComponent', 'component', 'function'],
                    type: 'function'
                }),
                createComponentNode({
                    fiberTag: 'Memo',
                    name: 'MemoPanel',
                    tags: ['Memo', 'component', 'memo'],
                    type: 'Memo'
                }),
                createComponentNode({
                    children: [
                        createComponentNode({
                            fiberTag: 'Lazy',
                            name: 'LazyPanel',
                            tags: ['Lazy', 'component', 'lazy'],
                            type: 'Lazy'
                        })
                    ],
                    fiberTag: 'Suspense',
                    name: 'Suspense',
                    tags: ['Suspense', 'boundary', 'suspense'],
                    type: 'suspense'
                })
            ],
            fiberTag: 'FunctionComponent',
            name: 'App',
            tags: ['FunctionComponent', 'component', 'function'],
            type: 'function'
        })
    ];
}

function createComponentNode(
    options: Partial<ComponentTreeNode> & {
        fiberTag: string;
        name: string;
        tags: string[];
        type: string;
    }
): ComponentTreeNode {
    const children = options.children ?? [];

    return {
        children,
        displayName: options.displayName ?? options.name,
        fiberTag: options.fiberTag,
        hasChildren: children.length > 0,
        id: options.id ?? `node:${options.name}`,
        key: options.key ?? null,
        name: options.name,
        rootId: options.rootId ?? 'root',
        tags: options.tags,
        type: options.type
    };
}

function summarizeTree(
    nodes: ComponentTreeNode[]
): Array<{ children: unknown[]; name: string }> {
    return nodes.map((node) => ({
        children: summarizeTree(node.children),
        name: node.name
    }));
}
