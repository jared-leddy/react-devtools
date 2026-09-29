import fixtureManifest from './assets/fixture-manifest.json';
import fixtureNotesUrl from './assets/fixture-notes.txt?url';
import fixtureMarkUrl from './assets/devtools-mark.svg';

export function AssetExplorerFixtures() {
    return (
        <section aria-labelledby="asset-explorer-fixtures-heading">
            <h2 id="asset-explorer-fixtures-heading">
                Asset explorer fixtures
            </h2>
            <div className="asset-fixture-layout">
                <article className="card asset-fixture-card">
                    <h3>imported image asset</h3>
                    <img
                        alt="React DevTools Vite fixture mark"
                        className="asset-fixture-image"
                        data-testid="asset-fixture-image"
                        src={fixtureMarkUrl}
                    />
                    <p data-testid="asset-fixture-image-url">
                        {fixtureMarkUrl}
                    </p>
                </article>
                <article className="card asset-fixture-card">
                    <h3>imported text assets</h3>
                    <dl className="asset-fixture-details">
                        <div>
                            <dt>Manifest</dt>
                            <dd data-testid="asset-fixture-manifest">
                                {fixtureManifest.id}:{' '}
                                {fixtureManifest.formats.join(', ')}
                            </dd>
                        </div>
                        <div>
                            <dt>Notes asset</dt>
                            <dd data-testid="asset-fixture-notes">
                                {fixtureNotesUrl}
                            </dd>
                        </div>
                    </dl>
                </article>
            </div>
        </section>
    );
}
