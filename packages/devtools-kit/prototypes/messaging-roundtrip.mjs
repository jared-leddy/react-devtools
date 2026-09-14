import { createRpcClient, createRpcServer } from '../dist/index.js';

const [clientChannel, serverChannel] = createLinkedChannels();

createRpcServer(
    {
        async fail() {
            throw new TypeError('prototype failure');
        },
        getCollections() {
            return {
                ids: new Set(['alpha', 'beta']),
                values: new Map([
                    ['one', 1],
                    ['two', 2]
                ])
            };
        }
    },
    { channel: serverChannel }
);

const client = createRpcClient({}, { channel: clientChannel });
const result = await client.getCollections();

assert(result.ids instanceof Set, 'ids did not round-trip as Set');
assert(result.values instanceof Map, 'values did not round-trip as Map');
assert(result.ids.has('alpha'), 'Set contents were lost');
assert(result.values.get('two') === 2, 'Map contents were lost');

try {
    await client.fail();
    throw new Error('expected client.fail() to reject');
} catch (error) {
    assert(error instanceof Error, 'rejection was not an Error');
    assert(
        error.message === 'prototype failure',
        'error message was not preserved'
    );
}

console.log('Messaging RPC prototype passed.');

function createLinkedChannels() {
    const leftListeners = new Set();
    const rightListeners = new Set();

    return [
        {
            off(listener) {
                leftListeners.delete(listener);
            },
            on(listener) {
                leftListeners.add(listener);
            },
            post(data) {
                for (const listener of rightListeners) {
                    listener(data);
                }
            }
        },
        {
            off(listener) {
                rightListeners.delete(listener);
            },
            on(listener) {
                rightListeners.add(listener);
            },
            post(data) {
                for (const listener of leftListeners) {
                    listener(data);
                }
            }
        }
    ];
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
