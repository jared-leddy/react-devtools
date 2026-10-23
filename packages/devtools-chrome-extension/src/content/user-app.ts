import { createPageBackend } from '@devtools/core/page-backend';
import { createExtensionServerChannel } from '@devtools/kit';

export function bootstrapUserAppRpcServer(target: Window) {
    return createPageBackend(
        target,
        createExtensionServerChannel({ window: target })
    );
}

const bootstrapResult = bootstrapUserAppRpcServer(window);
window.dispatchEvent(
    new CustomEvent('__react_devtools_user_app_ready__', {
        detail: { ...bootstrapResult, source: 'react-devtools-extension' }
    })
);
