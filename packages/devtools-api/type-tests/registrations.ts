import {
    addCustomCommand,
    addCustomTab,
    removeCustomCommand,
    setupDevToolsPlugin,
    type CustomCommand,
    type CustomTab,
    type TimelineEventOptions,
    type TimelineLayerOptions
} from '@devtools/api';
import { expectType, type Assert, type Equal } from './assertions.js';

const iframeTab: CustomTab = {
    name: 'counter-frame',
    title: 'Counter',
    iframeUrl: '/counter',
    sandbox: 'allow-scripts',
    persist: true
};
const viewTab: CustomTab = {
    name: 'counter-view',
    title: 'Counter',
    view: async () => ({ default: () => null }),
    path: '/counter',
    category: 'custom'
};
expectType<void>(addCustomTab(iframeTab));
expectType<void>(addCustomTab(viewTab));
const command: CustomCommand = {
    id: 'counter:reset',
    label: 'Reset',
    order: 1,
    action: async () => {},
    children: [
        { id: 'counter:docs', label: 'Docs', url: 'https://example.test' },
        { id: 'counter:tab', label: 'Counter', route: '/counter' }
    ]
};
expectType<void>(addCustomCommand(command));
expectType<void>(removeCustomCommand(command.id));

const layer: TimelineLayerOptions = {
    id: 'counter:actions',
    label: 'Actions',
    color: '#00ff00'
};
const event: TimelineEventOptions<{ count: number }> = {
    layerId: layer.id,
    title: 'Increment',
    subtitle: 'Counter',
    time: 10,
    groupId: 'action:1',
    data: { count: 1 }
};
setupDevToolsPlugin({ id: 'timeline', label: 'Timeline' }, (api) => {
    api.addTimelineLayer(layer);
    api.addTimelineEvent(event);
    // @ts-expect-error Timeline layers require IDs.
    api.addTimelineLayer({ label: 'Missing ID' });
    // @ts-expect-error Timeline events require a layer ID.
    api.addTimelineEvent({ title: 'No layer' });
    // @ts-expect-error Event timestamps are numeric.
    api.addTimelineEvent({ layerId: layer.id, title: 'Invalid', time: 'now' });
});
export type TimelineDataIsPreserved = Assert<
    Equal<
        TimelineEventOptions<{ count: number }>['data'],
        { count: number } | undefined
    >
>;
// @ts-expect-error Tabs require a stable name.
addCustomTab({ title: 'Missing name' });
// @ts-expect-error iframe URLs must be strings.
addCustomTab({ name: 'invalid', title: 'Invalid', iframeUrl: 42 });
// @ts-expect-error Commands require IDs.
addCustomCommand({ label: 'Missing ID' });
addCustomCommand({
    id: 'invalid',
    label: 'Invalid',
    // @ts-expect-error Command callbacks do not receive positional arguments.
    action: (_value: number) => {}
});
addCustomCommand({
    id: 'parent',
    label: 'Parent',
    // @ts-expect-error Nested commands retain required fields.
    children: [{ label: 'Missing ID' }]
});
// @ts-expect-error Removal accepts a command ID, not a command object.
removeCustomCommand(command);
