import { builtinModules, createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const builtins = new Set(
    builtinModules.map((name) => name.replace(/^node:/, ''))
);
const serverPackages = [
    'vite',
    '@devtools/vite-plugin',
    '@devtools/nextjs-plugin',
    'next',
    'sirv',
    'open',
    'launch-editor'
];
const appPackages = [
    'react',
    'react-dom',
    'react-router',
    'react-window',
    'next',
    '@devtools/client',
    '@devtools/ui',
    '@devtools/devtools-overlay',
    '@devtools/nekuta-plugin'
];

export function forbiddenModule(id, api = false) {
    if (
        [
            '\0vite/modulepreload-polyfill.js',
            '\0vite/preload-helper.js'
        ].includes(id)
    )
        return false;
    const normalized = id.replaceAll('\\', '/').replaceAll('\0', '');
    const bare = normalized
        .replace(/^__vite-browser-external:/, '')
        .replace(/^node:/, '');
    if (
        builtins.has(bare) ||
        normalized.startsWith('node:') ||
        normalized.includes('__vite-browser-external')
    )
        return true;
    return [...serverPackages, ...(api ? appPackages : [])].some(
        (name) =>
            normalized === name ||
            normalized.startsWith(`${name}/`) ||
            normalized.includes(`/node_modules/${name}/`) ||
            normalized.includes(
                `/packages/${name.replace('@devtools/', 'devtools-')}/`
            )
    );
}

export function browserBoundaryPlugin(api = false) {
    return {
        name: 'react-devtools-browser-boundaries',
        apply: 'build',
        generateBundle() {
            for (const id of this.getModuleIds()) {
                if (forbiddenModule(id, api))
                    this.error(`Browser dependency boundary violation: ${id}`);
            }
        }
    };
}

export function checkApiDependencies(
    root,
    resolveManifest = installedManifest
) {
    const visited = new Set();
    function visit(path, chain) {
        if (visited.has(path)) return;
        visited.add(path);
        const manifest = JSON.parse(readFileSync(path, 'utf8'));
        for (const name of Object.keys({
            ...manifest.dependencies,
            ...manifest.optionalDependencies,
            ...manifest.peerDependencies
        })) {
            // Browser transport declares its host tool as a peer, not an import.
            if (
                manifest.name === 'vite-hot-client' &&
                name === 'vite' &&
                !manifest.dependencies?.vite &&
                !manifest.optionalDependencies?.vite
            )
                continue;
            const next = [...chain, name];
            if (forbiddenModule(name, true))
                throw new Error(
                    `Plugin API dependency boundary violation: ${next.join(' -> ')}`
                );
            visit(resolveManifest(name, path), next);
        }
    }
    visit(join(root, 'packages/devtools-api/package.json'), ['@devtools/api']);
    return visited.size;
}

export function installedManifest(name, from) {
    const require = createRequire(from);
    for (const directory of require.resolve.paths(name) ?? []) {
        const candidate = join(directory, name, 'package.json');
        if (existsSync(candidate)) return candidate;
    }
    throw new Error(`Cannot resolve runtime dependency ${name} from ${from}`);
}

export function measureBundle(directory) {
    const files = [];
    function walk(current) {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (/\.(js|mjs|css)$/.test(entry.name)) files.push(path);
        }
    }
    walk(directory);
    if (!files.some((path) => /\.(js|mjs)$/.test(path)))
        throw new Error(`Missing JavaScript build outputs in ${directory}`);
    return files.sort().reduce(
        (result, path) => {
            const content = readFileSync(path);
            result.rawBytes += content.length;
            result.gzipBytes += gzipSync(content, { level: 9 }).length;
            result.files += 1;
            return result;
        },
        { rawBytes: 0, gzipBytes: 0, files: 0 }
    );
}

export function checkBundles(root, budgets) {
    const report = [];
    for (const budget of budgets) {
        for (const key of ['rawBytes', 'gzipBytes']) {
            if (!Number.isSafeInteger(budget[key]) || budget[key] <= 0)
                throw new Error(`Invalid ${key} budget for ${budget.name}`);
        }
        const measured = measureBundle(resolve(root, budget.directory));
        report.push({
            name: budget.name,
            ...measured,
            limits: { rawBytes: budget.rawBytes, gzipBytes: budget.gzipBytes }
        });
        for (const key of ['rawBytes', 'gzipBytes']) {
            if (measured[key] > budget[key])
                throw new Error(
                    `${budget.name} exceeds ${key} budget: ${measured[key]} > ${budget[key]}`
                );
        }
    }
    return report;
}
