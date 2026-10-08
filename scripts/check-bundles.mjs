import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { build } from 'vite';
import {
    browserBoundaryPlugin,
    checkApiDependencies,
    checkBundles
} from './bundle-checks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const budgets = JSON.parse(
    readFileSync(join(root, 'scripts/bundle-budgets.json'), 'utf8')
);
const apiPackages = checkApiDependencies(root);
await build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [browserBoundaryPlugin(true)],
    build: {
        write: false,
        lib: {
            entry: join(root, 'packages/devtools-api/dist/index.js'),
            formats: ['es'],
            fileName: 'api-boundary-probe'
        }
    }
});
const bundles = checkBundles(root, budgets);
mkdirSync(join(root, 'artifacts'), { recursive: true });
writeFileSync(
    join(root, 'artifacts/bundle-report.json'),
    JSON.stringify({ apiPackages, bundles }, null, 2) + '\n'
);
console.table(
    bundles.map(({ name, rawBytes, gzipBytes, files }) => ({
        name,
        rawBytes,
        gzipBytes,
        files
    }))
);
console.log(
    `Plugin API runtime dependency graph checked (${apiPackages} packages).`
);
