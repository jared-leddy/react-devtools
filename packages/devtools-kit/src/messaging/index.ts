import type {
    BirpcGroup,
    BirpcOptions,
    BirpcReturn,
    ChannelOptions
} from 'birpc';
import { createBirpc, createBirpcGroup } from 'birpc';
import SuperJSON from 'superjson';

export type Presets = 'iframe' | 'vite' | 'extension' | 'broadcast-channel';
export type RpcHost = 'client' | 'proxy' | 'server';
export type RpcChannel = Pick<ChannelOptions, 'off' | 'on' | 'post'>;
export type RpcChannelFactory = (preset: Presets, host: RpcHost) => RpcChannel;
export type RpcFunctions = Record<string, (...args: never[]) => unknown>;

export interface CreateRpcClientOptions<
    RemoteFunctions extends object,
    LocalFunctions extends object
> {
    channel?: RpcChannel;
    getChannel?: RpcChannelFactory;
    options?: Partial<BirpcOptions<RemoteFunctions, LocalFunctions>>;
    preset?: Presets;
}

export interface CreateRpcServerOptions<
    RemoteFunctions extends object,
    LocalFunctions extends object
> {
    channel?: RpcChannel;
    getChannel?: RpcChannelFactory;
    options?: Partial<BirpcOptions<RemoteFunctions, LocalFunctions>>;
    preset?: Presets;
}

export interface CreateRpcProxyOptions<
    RemoteFunctions extends object,
    LocalFunctions extends object
> {
    channel?: RpcChannel;
    getChannel?: RpcChannelFactory;
    options?: Partial<BirpcOptions<RemoteFunctions, LocalFunctions>>;
    preset?: Presets;
}

interface ResolveRpcChannelOptions {
    channel?: RpcChannel;
    getChannel?: RpcChannelFactory;
    preset?: Presets;
}

export const rpcSerializer = {
    deserialize<T = unknown>(payload: unknown): T {
        return SuperJSON.deserialize<T>(
            payload as Parameters<typeof SuperJSON.deserialize>[0]
        );
    },
    serialize(payload: unknown): unknown {
        return SuperJSON.serialize(
            payload as Parameters<typeof SuperJSON.serialize>[0]
        );
    }
};

export function createRpcClient<
    RemoteFunctions extends object = Record<string, never>,
    LocalFunctions extends object = Record<string, never>
>(
    functions: LocalFunctions,
    options: CreateRpcClientOptions<RemoteFunctions, LocalFunctions> = {}
): BirpcReturn<RemoteFunctions, LocalFunctions> {
    const channel = withRpcSerializer(resolveRpcChannel(options, 'client'));

    return createBirpc<RemoteFunctions, LocalFunctions>(functions, {
        ...options.options,
        ...channel,
        timeout: options.options?.timeout ?? -1
    });
}

export function createRpcServer<
    RemoteFunctions extends object = Record<string, never>,
    LocalFunctions extends object = Record<string, never>
>(
    functions: LocalFunctions,
    options: CreateRpcServerOptions<RemoteFunctions, LocalFunctions> = {}
): BirpcGroup<RemoteFunctions, LocalFunctions> {
    const channel = withRpcSerializer(resolveRpcChannel(options, 'server'));

    return createBirpcGroup<RemoteFunctions, LocalFunctions>(
        functions,
        [channel],
        {
            ...options.options,
            timeout: options.options?.timeout ?? -1
        }
    );
}

export function createRpcProxy<
    RemoteFunctions extends object = Record<string, never>,
    LocalFunctions extends object = Record<string, never>
>(
    options: CreateRpcProxyOptions<RemoteFunctions, LocalFunctions> = {}
): BirpcReturn<RemoteFunctions, LocalFunctions> {
    const channel = withRpcSerializer(resolveRpcChannel(options, 'proxy'));

    return createBirpc<RemoteFunctions, LocalFunctions>({} as LocalFunctions, {
        ...options.options,
        ...channel,
        timeout: options.options?.timeout ?? -1
    });
}

function withRpcSerializer(channel: RpcChannel): ChannelOptions {
    return {
        ...channel,
        deserialize: rpcSerializer.deserialize,
        serialize: rpcSerializer.serialize
    };
}

function resolveRpcChannel(
    options: ResolveRpcChannelOptions,
    host: RpcHost
): RpcChannel {
    if (options.channel) {
        return options.channel;
    }

    if (options.preset && options.getChannel) {
        return options.getChannel(options.preset, host);
    }

    if (options.preset) {
        throw new Error(
            `RPC preset "${options.preset}" is not available until its channel factory is registered.`
        );
    }

    throw new Error('RPC channel is required when no preset is provided.');
}
