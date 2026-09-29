import { useEffect } from 'react';
import {
    createDevToolsContext,
    registerDevToolsPluginContext
} from '@devtools/kit';

export function DevToolsPluginContext() {
    useEffect(() => {
        registerDevToolsPluginContext({
            context: createDevToolsContext({
                shouldBridgeHookEvents: false
            }),
            hasRoot: true
        });
    }, []);

    return null;
}
