function createOfficialStyleHook() {
    let uid = 0;
    const listeners = new Map();
    const rendererInterfaces = new Map();
    const renderers = new Map();
    const commits = [];
    const unmounts = [];

    const hook = {
        commits,
        listeners,
        rendererInterfaces,
        renderers,
        supportsFiber: true,
        unmounts,
        emit(event, payload) {
            for (const listener of listeners.get(event) ?? []) {
                listener(payload);
            }
        },
        getFiberRoots(rendererID) {
            if (!this.fiberRoots) {
                this.fiberRoots = new Map();
            }

            if (!this.fiberRoots.has(rendererID)) {
                this.fiberRoots.set(rendererID, new Set());
            }

            return this.fiberRoots.get(rendererID);
        },
        inject(renderer) {
            const id = ++uid;
            renderers.set(id, renderer);
            rendererInterfaces.set(id, {renderer});
            this.emit('renderer', {id, renderer});
            this.emit('renderer-attached', {
                id,
                rendererInterface: rendererInterfaces.get(id),
            });
            return id;
        },
        off(event, listener) {
            const eventListeners = listeners.get(event);
            if (!eventListeners) {
                return;
            }

            const index = eventListeners.indexOf(listener);
            if (index >= 0) {
                eventListeners.splice(index, 1);
            }
        },
        on(event, listener) {
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }

            listeners.get(event).push(listener);
        },
        onCommitFiberRoot(rendererID, root, priorityLevel, didError) {
            commits.push({didError, priorityLevel, rendererID, root});
        },
        onCommitFiberUnmount(rendererID, fiber) {
            unmounts.push({fiber, rendererID});
        },
        onPostCommitFiberRoot() {},
        sub(event, listener) {
            this.on(event, listener);
            return () => this.off(event, listener);
        },
    };

    return hook;
}

function installOfficialHook(target) {
    if (Object.prototype.hasOwnProperty.call(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__')) {
        return null;
    }

    const hook = createOfficialStyleHook();
    Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        configurable: true,
        enumerable: false,
        value: hook,
    });
    return hook;
}

function installOurObserver(target) {
    const existingHook = target.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const observed = {
        commits: [],
        injections: [],
        mode: existingHook ? 'wrapped' : 'installed',
        unmounts: [],
    };

    if (!existingHook) {
        const hook = createOfficialStyleHook();
        hook.on('renderer', (payload) => observed.injections.push(payload));
        const originalCommit = hook.onCommitFiberRoot.bind(hook);
        const originalUnmount = hook.onCommitFiberUnmount.bind(hook);
        hook.onCommitFiberRoot = (...args) => {
            const result = originalCommit(...args);
            observed.commits.push(args);
            return result;
        };
        hook.onCommitFiberUnmount = (...args) => {
            const result = originalUnmount(...args);
            observed.unmounts.push(args);
            return result;
        };

        Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
            configurable: true,
            enumerable: false,
            value: hook,
        });

        return observed;
    }

    existingHook.on?.('renderer', (payload) => observed.injections.push(payload));

    const originalCommit = existingHook.onCommitFiberRoot?.bind(existingHook);
    const originalUnmount = existingHook.onCommitFiberUnmount?.bind(existingHook);

    existingHook.onCommitFiberRoot = (...args) => {
        const result = originalCommit?.(...args);
        observed.commits.push(args);
        return result;
    };
    existingHook.onCommitFiberUnmount = (...args) => {
        const result = originalUnmount?.(...args);
        observed.unmounts.push(args);
        return result;
    };

    return observed;
}

function simulateReactRenderer(target) {
    const hook = target.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook?.supportsFiber) {
        return null;
    }

    const rendererID = hook.inject({rendererPackageName: 'react-dom', version: '19.1.1'});
    hook.onCommitFiberRoot(rendererID, {current: {memoizedState: {element: 'App'}}});
    hook.onCommitFiberUnmount(rendererID, {tag: 'FunctionComponent'});

    return rendererID;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runWrappedScenario() {
    const target = {};
    const officialHook = installOfficialHook(target);
    const observed = installOurObserver(target);
    const rendererID = simulateReactRenderer(target);

    assert(observed.mode === 'wrapped', 'expected wrapper mode');
    assert(target.__REACT_DEVTOOLS_GLOBAL_HOOK__ === officialHook, 'wrapper replaced the hook');
    assert(rendererID === 1, 'official hook did not allocate the renderer id');
    assert(officialHook.renderers.size === 1, 'official hook missed renderer injection');
    assert(officialHook.commits.length === 1, 'official hook missed commit');
    assert(officialHook.unmounts.length === 1, 'official hook missed unmount');
    assert(observed.injections.length === 1, 'observer missed renderer injection');
    assert(observed.commits.length === 1, 'observer missed commit');
    assert(observed.unmounts.length === 1, 'observer missed unmount');
}

function runReplacementScenario() {
    const target = {};
    const officialHook = installOfficialHook(target);

    Object.defineProperty(target, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        configurable: true,
        enumerable: false,
        value: createOfficialStyleHook(),
    });

    simulateReactRenderer(target);

    assert(officialHook.renderers.size === 0, 'official hook unexpectedly saw replacement injection');
    assert(target.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== officialHook, 'replacement did not change identity');
}

function runInstalledScenario() {
    const target = {};
    const observed = installOurObserver(target);
    const rendererID = simulateReactRenderer(target);

    assert(observed.mode === 'installed', 'expected install mode');
    assert(rendererID === 1, 'minimal hook did not allocate renderer id');
    assert(observed.injections.length === 1, 'minimal hook missed renderer injection');
    assert(observed.commits.length === 1, 'minimal hook missed commit');
    assert(observed.unmounts.length === 1, 'minimal hook missed unmount');
}

runWrappedScenario();
runReplacementScenario();
runInstalledScenario();

console.log('React global hook coexistence prototype passed.');
