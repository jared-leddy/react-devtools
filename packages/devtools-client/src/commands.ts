import {
    ReactDevToolsContextHookKeys,
    getCustomCommands,
    type CustomCommand,
    type DevToolsContext
} from '@devtools/kit';
import type { ClientRoute } from './routing';

export type ClientCommandSource = 'built-in' | 'plugin';

export interface ClientCommand {
    action?: () => Promise<void> | void;
    group: string[];
    id: string;
    label: string;
    order: number;
    route?: string;
    source: ClientCommandSource;
    url?: string;
}

export interface ClientCommandRegistrySnapshot {
    customCommands: CustomCommand[];
}

type CommandListener = () => void;

const listeners = new Set<CommandListener>();
let currentSnapshot: ClientCommandRegistrySnapshot = {
    customCommands: []
};
let initialized = false;

export function registerClientCommandContext(context: DevToolsContext): void {
    if (initialized) {
        refreshCommandSnapshot();
        return;
    }

    initialized = true;
    context.hooks.hook(
        ReactDevToolsContextHookKeys.CUSTOM_COMMAND_ADDED,
        () => {
            notifyCommandListeners();
        }
    );
    context.hooks.hook(
        ReactDevToolsContextHookKeys.CUSTOM_COMMAND_REMOVED,
        () => {
            notifyCommandListeners();
        }
    );
    refreshCommandSnapshot();
}

export function subscribeToClientCommands(
    listener: CommandListener
): () => void {
    listeners.add(listener);
    refreshCommandSnapshot();

    return () => {
        listeners.delete(listener);
    };
}

export function getClientCommandSnapshot(): ClientCommandRegistrySnapshot {
    return currentSnapshot;
}

export function getVisibleClientCommands({
    customCommands,
    routes
}: {
    customCommands: CustomCommand[];
    routes: ClientRoute[];
}): ClientCommand[] {
    return [
        ...getBuiltInCommands(routes),
        ...customCommands.flatMap((command) =>
            toClientCommand(command, ['Plugins'])
        )
    ].sort((command, nextCommand) => {
        if (command.order !== nextCommand.order) {
            return command.order - nextCommand.order;
        }

        return command.label.localeCompare(nextCommand.label);
    });
}

export function resetClientCommandRegistryForTests(): void {
    listeners.clear();
    initialized = false;
    refreshCommandSnapshot();
}

function getBuiltInCommands(routes: ClientRoute[]): ClientCommand[] {
    return [
        ...routes.map((route, index) => ({
            group: ['Navigate'],
            id: `navigate:${route.id}`,
            label: `Go to ${route.label}`,
            order: index,
            route: route.path,
            source: 'built-in' as const
        })),
        {
            group: ['Docs'],
            id: 'docs:react',
            label: 'Open React docs',
            order: 1000,
            source: 'built-in',
            url: 'https://react.dev'
        },
        {
            group: ['Docs'],
            id: 'docs:project',
            label: 'Open project docs',
            order: 1001,
            source: 'built-in',
            url: 'https://github.com/jared-leddy/react-devtools'
        }
    ];
}

function toClientCommand(
    command: CustomCommand,
    group: string[]
): ClientCommand[] {
    const commandGroup = [...group, command.label];
    const currentCommand: ClientCommand = {
        action: command.action,
        group,
        id: `plugin:${command.id}`,
        label: command.label,
        order: command.order ?? 500,
        route: command.route,
        source: 'plugin',
        url: command.url
    };
    const children =
        command.children?.flatMap((child) =>
            toClientCommand(child, commandGroup)
        ) ?? [];

    return [currentCommand, ...children];
}

function notifyCommandListeners(): void {
    refreshCommandSnapshot();
    listeners.forEach((listener) => listener());
}

function refreshCommandSnapshot(): void {
    currentSnapshot = {
        customCommands: getCustomCommands()
    };
}
