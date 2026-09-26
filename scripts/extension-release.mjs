import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = {
    chrome: {
        manifestPath: 'packages/devtools-chrome-extension/public/manifest.json',
        packageName: '@devtools/chrome-extension',
        packagePath: 'packages/devtools-chrome-extension/package.json',
        packageRoot: 'packages/devtools-chrome-extension',
        smokePath: 'packages/devtools-chrome-extension/src/smoke.tsx'
    },
    firefox: {
        manifestPath:
            'packages/devtools-firefox-extension/public/manifest.json',
        packageName: '@devtools/firefox-extension',
        packagePath: 'packages/devtools-firefox-extension/package.json',
        packageRoot: 'packages/devtools-firefox-extension',
        smokePath: 'packages/devtools-firefox-extension/src/smoke.tsx'
    }
};

const REQUIRED_DIST_FILES = [
    'manifest.json',
    'background.js',
    'devtools.html',
    'devtools.js',
    'popup.html',
    'popup.js',
    'prepare.js',
    'proxy.js',
    'smoke.html',
    'smoke.js'
];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value >>> 0;
});

export function parseCli(argv) {
    const [command = 'help', ...rawArgs] = argv;
    const options = {
        dryRun: false,
        outDir: 'dist/extensions',
        skipBuild: false,
        target: 'all',
        version: undefined
    };

    for (let index = 0; index < rawArgs.length; index += 1) {
        const arg = rawArgs[index];

        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--skip-build') {
            options.skipBuild = true;
        } else if (arg === '--target') {
            options.target = rawArgs[index + 1];
            index += 1;
        } else if (arg.startsWith('--target=')) {
            options.target = arg.slice('--target='.length);
        } else if (arg === '--version') {
            options.version = rawArgs[index + 1];
            index += 1;
        } else if (arg.startsWith('--version=')) {
            options.version = arg.slice('--version='.length);
        } else if (arg === '--out-dir') {
            options.outDir = rawArgs[index + 1];
            index += 1;
        } else if (arg.startsWith('--out-dir=')) {
            options.outDir = arg.slice('--out-dir='.length);
        } else {
            throw new Error(`unknown argument: ${arg}`);
        }
    }

    return { command, options };
}

export function validateVersion(version) {
    if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
        throw new Error(
            `invalid --version "${version ?? ''}" - expected semver like 0.1.2 or 0.1.2-beta.1`
        );
    }
}

export function getExtensionTargets(target) {
    if (target === 'all') {
        return Object.keys(EXTENSIONS);
    }

    if (!Object.hasOwn(EXTENSIONS, target)) {
        throw new Error(
            `unknown --target "${target}" - expected chrome, firefox, or all`
        );
    }

    return [target];
}

export function createArtifactName(target, version) {
    return `react-devtools-${target}-extension-v${version}.zip`;
}

export function updateExtensionVersions({
    cwd = repoRoot,
    dryRun = false,
    stdout = console.log,
    targets = Object.keys(EXTENSIONS),
    version
}) {
    validateVersion(version);

    const changes = targets.flatMap((target) => {
        const plan = EXTENSIONS[target];
        const packageFile = join(cwd, plan.packagePath);
        const manifestFile = join(cwd, plan.manifestPath);
        const smokeFile = join(cwd, plan.smokePath);
        const packageJson = readJson(packageFile);
        const manifest = readJson(manifestFile);
        const smokeSource = readFileSync(smokeFile, 'utf8');
        const nextSmokeSource = smokeSource.replace(
            /version: '[^']+'/,
            `version: '${version}'`
        );

        return [
            {
                file: packageFile,
                next: `${JSON.stringify({ ...packageJson, version }, null, 4)}\n`,
                previousVersion: packageJson.version,
                target
            },
            {
                file: manifestFile,
                next: `${JSON.stringify({ ...manifest, version }, null, 4)}\n`,
                previousVersion: manifest.version,
                target
            },
            {
                file: smokeFile,
                next: nextSmokeSource,
                previousVersion: extractSmokeVersion(smokeSource),
                target
            }
        ];
    });

    for (const change of changes) {
        stdout(
            `${dryRun ? 'would update' : 'updated'} ${relative(cwd, change.file)} (${change.previousVersion} -> ${version})`
        );

        if (!dryRun) {
            writeFileSync(change.file, change.next, 'utf8');
        }
    }

    return changes;
}

export function packageExtensions({
    cwd = repoRoot,
    dryRun = false,
    outDir = 'dist/extensions',
    skipBuild = false,
    stdout = console.log,
    targets = Object.keys(EXTENSIONS),
    versionOverride
}) {
    const outputDir = join(cwd, outDir);
    const artifacts = [];

    if (!dryRun) {
        rmSync(outputDir, { force: true, recursive: true });
        mkdirSync(outputDir, { recursive: true });
    }

    for (const target of targets) {
        const plan = EXTENSIONS[target];
        const packageJson = readJson(join(cwd, plan.packagePath));
        const manifest = readJson(join(cwd, plan.manifestPath));
        const artifactVersion = versionOverride ?? packageJson.version;

        if (!versionOverride && manifest.version !== packageJson.version) {
            throw new Error(
                `${target} manifest version ${manifest.version} does not match package version ${packageJson.version}`
            );
        }

        if (!skipBuild) {
            const buildMessage = `npm run build --workspace ${plan.packageName}`;
            stdout(`${dryRun ? 'would run' : 'running'} ${buildMessage}`);

            if (!dryRun) {
                execFileSync('npm', ['run', 'build', '--workspace', plan.packageName], {
                    cwd,
                    stdio: 'inherit'
                });
            }
        }

        const distDir = join(cwd, plan.packageRoot, 'dist');
        const missing = REQUIRED_DIST_FILES.filter(
            (file) => !existsSync(join(distDir, file))
        );

        if (!dryRun && missing.length > 0) {
            throw new Error(
                `${target} extension dist is missing required files: ${missing.join(', ')}`
            );
        }

        const artifactName = createArtifactName(target, artifactVersion);
        const artifactPath = join(outputDir, artifactName);
        const checksumPath = `${artifactPath}.sha256`;

        stdout(
            `${dryRun ? 'would write' : 'writing'} ${relative(cwd, artifactPath)}`
        );

        if (!dryRun) {
            const zipBuffer = createZipFromDirectory(distDir);
            const checksum = createHash('sha256').update(zipBuffer).digest('hex');

            writeFileSync(artifactPath, zipBuffer);
            writeFileSync(
                checksumPath,
                `${checksum}  ${basename(artifactPath)}\n`,
                'utf8'
            );
        }

        artifacts.push({
            checksumPath,
            path: artifactPath,
            target,
            version: artifactVersion
        });
    }

    return artifacts;
}

export function createZipFromDirectory(directory) {
    const files = listFiles(directory);
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
        const source = readFileSync(join(directory, file));
        const compressed = deflateRawSync(source, { level: 9 });
        const crc = crc32(source);
        const name = Buffer.from(file, 'utf8');
        const localHeader = createLocalHeader({
            compressedSize: compressed.length,
            crc,
            name,
            uncompressedSize: source.length
        });
        const centralHeader = createCentralHeader({
            compressedSize: compressed.length,
            crc,
            localHeaderOffset: offset,
            name,
            uncompressedSize: source.length
        });

        localParts.push(localHeader, name, compressed);
        centralParts.push(centralHeader, name);
        offset += localHeader.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = createEndOfCentralDirectory({
        centralDirectoryOffset: offset,
        centralDirectorySize: centralDirectory.length,
        entries: files.length
    });

    return Buffer.concat([...localParts, centralDirectory, end]);
}

export function printHelp(stdout = console.log) {
    stdout(`Extension release helper

Commands:
  version --version <semver> [--target chrome|firefox|all] [--dry-run]
  package [--target chrome|firefox|all] [--out-dir dist/extensions] [--skip-build] [--dry-run]
  prepare --version <semver> [--target chrome|firefox|all] [--out-dir dist/extensions] [--dry-run]

Examples:
  npm run extensions:version -- --version 0.1.0 --dry-run
  npm run extensions:prepare -- --version 0.1.0
  npm run extensions:package -- --target firefox --skip-build`);
}

export function runCli(argv, { cwd = repoRoot, stdout = console.log } = {}) {
    const { command, options } = parseCli(argv);
    const targets = getExtensionTargets(options.target);

    if (command === 'help' || command === '--help' || command === '-h') {
        printHelp(stdout);
        return;
    }

    if (command === 'version') {
        updateExtensionVersions({
            cwd,
            dryRun: options.dryRun,
            stdout,
            targets,
            version: options.version
        });
        return;
    }

    if (command === 'package') {
        packageExtensions({
            cwd,
            dryRun: options.dryRun,
            outDir: options.outDir,
            skipBuild: options.skipBuild,
            stdout,
            targets
        });
        return;
    }

    if (command === 'prepare') {
        updateExtensionVersions({
            cwd,
            dryRun: options.dryRun,
            stdout,
            targets,
            version: options.version
        });
        packageExtensions({
            cwd,
            dryRun: options.dryRun,
            outDir: options.outDir,
            skipBuild: options.skipBuild,
            stdout,
            targets,
            versionOverride: options.dryRun ? options.version : undefined
        });
        return;
    }

    throw new Error(`unknown command: ${command}`);
}

function readJson(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
}

function extractSmokeVersion(source) {
    return /version: '([^']+)'/.exec(source)?.[1] ?? 'unknown';
}

function listFiles(directory) {
    const files = [];

    function walk(current) {
        for (const entry of readdirSync(current).sort()) {
            const absolute = join(current, entry);
            const stats = statSync(absolute);

            if (stats.isDirectory()) {
                walk(absolute);
            } else if (stats.isFile()) {
                files.push(relative(directory, absolute).split(sep).join('/'));
            }
        }
    }

    walk(directory);
    return files;
}

function crc32(buffer) {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function createLocalHeader({
    compressedSize,
    crc,
    name,
    uncompressedSize
}) {
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressedSize, 18);
    header.writeUInt32LE(uncompressedSize, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);

    return header;
}

function createCentralHeader({
    compressedSize,
    crc,
    localHeaderOffset,
    name,
    uncompressedSize
}) {
    const header = Buffer.alloc(46);

    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressedSize, 20);
    header.writeUInt32LE(uncompressedSize, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(localHeaderOffset, 42);

    return header;
}

function createEndOfCentralDirectory({
    centralDirectoryOffset,
    centralDirectorySize,
    entries
}) {
    const record = Buffer.alloc(22);

    record.writeUInt32LE(0x06054b50, 0);
    record.writeUInt16LE(0, 4);
    record.writeUInt16LE(0, 6);
    record.writeUInt16LE(entries, 8);
    record.writeUInt16LE(entries, 10);
    record.writeUInt32LE(centralDirectorySize, 12);
    record.writeUInt32LE(centralDirectoryOffset, 16);
    record.writeUInt16LE(0, 20);

    return record;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        runCli(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
