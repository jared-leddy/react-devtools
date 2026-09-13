import { defineStore } from '../lib/nekuta-store-shim';

type CounterState = ReturnType<typeof createInitialCounterState>;

function createInitialCounterState() {
    return { count: 0 };
}

export const useCounterStore = defineStore({
    id: 'counter',
    state: createInitialCounterState,
    getters: {
        doubleCount: (state: CounterState) => state.count * 2
    },
    actions: {
        increment(this: { count: number }, by = 1) {
            this.count += by;
        },
        decrement(this: { count: number }, by = 1) {
            this.count -= by;
        },
        reset(this: { count: number }) {
            this.count = 0;
        }
    }
});
