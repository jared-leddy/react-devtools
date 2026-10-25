import { createPageBackend } from '@devtools/core/page-backend';
import { createExtensionServerChannel } from '@devtools/kit';

export function bootstrapUserAppRpcServer(target: Window) {
    return createPageBackend(
        target,
        createExtensionServerChannel({ window: target }),
        Symbol.for('react-devtools.page-backend')
    );
}

const bootstrapResult =
    window.top === window
        ? bootstrapUserAppRpcServer(window)
        : {
              didOpenRpcServer: false,
              hookMode: 'disabled' as const,
              rendererCount: 0,
              rootCount: 0
          };
const lifecycleWindow = window as Window & {
    __reactDevtoolsRestoreInstalled?: boolean;
};
if (!lifecycleWindow.__reactDevtoolsRestoreInstalled) {
    lifecycleWindow.__reactDevtoolsRestoreInstalled = true;
    window.addEventListener('pageshow', (event) => {
        if (event.persisted && window.top === window)
            bootstrapUserAppRpcServer(window);
    });
}
window.dispatchEvent(
    new CustomEvent('__react_devtools_user_app_ready__', {
        detail: { ...bootstrapResult, source: 'react-devtools-extension' }
    })
);
