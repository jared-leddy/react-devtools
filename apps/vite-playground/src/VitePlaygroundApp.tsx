import { AssetExplorerFixtures } from './AssetExplorerFixtures';
import { CustomPluginPlayground } from './CustomPluginPlayground';
import { DevToolsPluginContext } from './DevToolsPluginContext';
import { MultiRootStressPlayground } from './MultiRootStressPlayground';
import { NekutaDemos } from './NekutaDemos';
import { PlainReactDemos } from './PlainReactDemos';
import { ReactRouterDemo } from './ReactRouterDemo';

export function VitePlaygroundApp() {
    return (
        <main className="shell">
            <DevToolsPluginContext />
            <header className="hero">
                <p className="eyebrow">Vite delivery mode</p>
                <h1>React DevTools Vite Playground</h1>
                <p>
                    The same plain React fixture surface used by the Next.js
                    playground, served through Vite with the devtools plugin
                    active.
                </p>
            </header>
            <PlainReactDemos />
            <AssetExplorerFixtures />
            <MultiRootStressPlayground />
            <CustomPluginPlayground />
            <ReactRouterDemo />
            <NekutaDemos />
        </main>
    );
}
