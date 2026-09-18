import { ReactFiberTag, getProps, getPropsStateSection } from '../src/index.js';
import type { ReactFiber } from '../src/index.js';

describe('fiber state extraction', () => {
    it('extracts own enumerable props from function components without children by default', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: 'ignored child',
                count: 3,
                enabled: true,
                label: 'Clicks'
            },
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getProps(fiber)).toEqual({
            count: 3,
            enabled: true,
            label: 'Clicks'
        });
    });

    it('extracts props from class components and can include children explicitly', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: ['visible child'],
                mode: 'class',
                title: 'Class widget'
            },
            tag: ReactFiberTag.ClassComponent
        });

        expect(getProps(fiber)).toEqual({
            mode: 'class',
            title: 'Class widget'
        });
        expect(getProps(fiber, { includeChildren: true })).toEqual({
            children: ['visible child'],
            mode: 'class',
            title: 'Class widget'
        });
    });

    it('only returns own enumerable string-keyed props', () => {
        const inheritedProps = { inherited: 'hidden' };
        const props = Object.create(inheritedProps) as Record<string, unknown>;
        Object.defineProperty(props, 'nonEnumerable', {
            enumerable: false,
            value: 'hidden'
        });
        props.visible = 'shown';

        const fiber = createFiberFixture({
            memoizedProps: props,
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getProps(fiber)).toEqual({ visible: 'shown' });
    });

    it('returns an empty props object for non-object memoized props', () => {
        expect(
            getProps(
                createFiberFixture({
                    memoizedProps: null,
                    tag: ReactFiberTag.FunctionComponent
                })
            )
        ).toEqual({});
        expect(
            getProps(
                createFiberFixture({
                    memoizedProps: 'not props',
                    tag: ReactFiberTag.FunctionComponent
                })
            )
        ).toEqual({});
    });

    it('creates a displayable props section', () => {
        const fiber = createFiberFixture({
            memoizedProps: {
                children: 'ignored child',
                label: 'Counter',
                step: 2
            },
            tag: ReactFiberTag.FunctionComponent
        });

        expect(getPropsStateSection(fiber)).toEqual({
            fields: [
                { name: 'label', value: 'Counter' },
                { name: 'step', value: 2 }
            ],
            name: 'props'
        });
    });
});

function createFiberFixture(options: {
    memoizedProps?: unknown;
    tag: ReactFiberTag;
}): ReactFiber {
    return {
        actualDuration: 0,
        actualStartTime: -1,
        alternate: null,
        child: null,
        childLanes: 0,
        deletions: null,
        dependencies: null,
        elementType: null,
        flags: 0,
        index: 0,
        key: null,
        lanes: 0,
        memoizedProps: options.memoizedProps ?? null,
        memoizedState: null,
        mode: 1,
        pendingProps: null,
        ref: null,
        return: null,
        selfBaseDuration: 0,
        sibling: null,
        stateNode: null,
        subtreeFlags: 0,
        tag: options.tag,
        treeBaseDuration: 0,
        type: null,
        updateQueue: null
    };
}
