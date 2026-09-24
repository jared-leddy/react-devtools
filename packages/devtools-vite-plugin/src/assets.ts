import { createReadStream } from 'node:fs';
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import type {
    ViteTransportChannel,
    ViteTransportPayload
} from './viteTransport.js';

export const VITE_ASSET_RPC_LIST_REQUEST = 'devtools:assets:list';
export const VITE_ASSET_RPC_LIST_RESPONSE = 'devtools:assets:list:response';
export const VITE_ASSET_RPC_READ_REQUEST = 'devtools:assets:read';
export const VITE_ASSET_RPC_READ_RESPONSE = 'devtools:assets:read:response';
export const VITE_ASSET_UPDATE_EVENT = 'devtools:assets:update';

export type ViteAssetKind =
    'audio' | 'font' | 'image' | 'other' | 'text' | 'video' | 'wasm';

export interface ViteAssetRecord {
    filePath: string;
    image?: ViteAssetImageMetadata;
    kind: ViteAssetKind;
    mtime: number;
    publicPath: string;
    relativePath: string;
    size: number;
}

export interface ViteAssetImageMetadata {
    height?: number;
    type: 'gif' | 'jpeg' | 'png' | 'svg' | 'webp' | 'unknown';
    width?: number;
}

export interface ViteAssetReadResult {
    content: string;
    encoding: 'utf8';
    filePath: string;
    kind: ViteAssetKind;
    truncated: boolean;
}

export interface ViteAssetListRequest {
    requestId: string;
    type: typeof VITE_ASSET_RPC_LIST_REQUEST;
}

export interface ViteAssetListResponse {
    assets: ViteAssetRecord[];
    requestId: string;
    type: typeof VITE_ASSET_RPC_LIST_RESPONSE;
}

export interface ViteAssetReadRequest {
    filePath: string;
    maxBytes?: number;
    requestId: string;
    type: typeof VITE_ASSET_RPC_READ_REQUEST;
}

export interface ViteAssetReadResponse {
    error?: string;
    requestId: string;
    result?: ViteAssetReadResult;
    type: typeof VITE_ASSET_RPC_READ_RESPONSE;
}

export interface ViteAssetUpdateEvent {
    type: typeof VITE_ASSET_UPDATE_EVENT;
}

export interface ViteAssetExplorerOptions {
    maxTextBytes?: number;
    root?: string;
    updateDebounceMs?: number;
}

type ImageCacheEntry = {
    metadata: ViteAssetImageMetadata;
    signature: string;
};

const DEFAULT_MAX_TEXT_BYTES = 64 * 1024;
const DEFAULT_UPDATE_DEBOUNCE_MS = 80;
const excludedDirectoryNames = new Set([
    '.git',
    '.next',
    '.turbo',
    'build',
    'coverage',
    'dist',
    'node_modules'
]);
const excludedFilenames = new Set([
    'bun.lockb',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock'
]);
const imageExtensions = new Set([
    '.apng',
    '.avif',
    '.gif',
    '.jpeg',
    '.jpg',
    '.png',
    '.svg',
    '.webp'
]);
const videoExtensions = new Set([
    '.avi',
    '.m4v',
    '.mov',
    '.mp4',
    '.mpeg',
    '.mpg',
    '.ogg',
    '.ogv',
    '.webm'
]);
const audioExtensions = new Set([
    '.aac',
    '.flac',
    '.m4a',
    '.mp3',
    '.oga',
    '.ogg',
    '.opus',
    '.wav',
    '.weba'
]);
const fontExtensions = new Set(['.eot', '.otf', '.ttf', '.woff', '.woff2']);
const textExtensions = new Set([
    '.css',
    '.csv',
    '.graphql',
    '.html',
    '.js',
    '.json',
    '.jsx',
    '.md',
    '.mjs',
    '.svg',
    '.toml',
    '.ts',
    '.tsx',
    '.txt',
    '.xml',
    '.yaml',
    '.yml'
]);

const imageMetadataCache = new Map<string, ImageCacheEntry>();

export async function listViteAssets(
    root: string,
    options: ViteAssetExplorerOptions = {}
): Promise<ViteAssetRecord[]> {
    const rootDir = resolve(options.root ?? root);
    const files = await collectAssetFiles(rootDir);
    const assets = await Promise.all(
        files.map(async (filePath) => {
            const fileStat = await stat(filePath);
            const kind = classifyAsset(filePath);
            const record: ViteAssetRecord = {
                filePath,
                kind,
                mtime: fileStat.mtimeMs,
                publicPath: getViteAssetPublicPath(rootDir, filePath),
                relativePath: toPosixPath(relative(rootDir, filePath)),
                size: fileStat.size
            };

            if (kind === 'image') {
                record.image = await readImageMetadata(filePath, fileStat);
            }

            return record;
        })
    );

    return assets.sort((first, second) =>
        first.relativePath.localeCompare(second.relativePath)
    );
}

export async function readViteAssetText(
    root: string,
    filePath: string,
    options: ViteAssetExplorerOptions = {}
): Promise<ViteAssetReadResult> {
    const rootDir = resolve(options.root ?? root);
    const resolvedFilePath = resolve(filePath);

    if (!isInsideRoot(rootDir, resolvedFilePath)) {
        throw new Error('Asset path is outside the Vite project root.');
    }

    const fileStat = await stat(resolvedFilePath);
    const maxBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
    const bytesToRead = Math.min(fileStat.size, maxBytes);
    const handle = await open(resolvedFilePath, 'r');

    try {
        const buffer = Buffer.alloc(bytesToRead);
        await handle.read(buffer, 0, bytesToRead, 0);

        return {
            content: buffer.toString('utf8'),
            encoding: 'utf8',
            filePath: resolvedFilePath,
            kind: classifyAsset(resolvedFilePath),
            truncated: fileStat.size > maxBytes
        };
    } finally {
        await handle.close();
    }
}

export function installViteAssetRpc(
    server: ViteDevServer,
    channel: ViteTransportChannel,
    options: ViteAssetExplorerOptions = {}
): void {
    const root = resolve(options.root ?? server.config?.root ?? process.cwd());

    channel.on((payload) => {
        void handleViteAssetRpcPayload(channel, root, payload, options);
    });

    installAssetWatcher(server, channel, options);
}

export async function handleViteAssetRpcPayload(
    channel: ViteTransportChannel,
    root: string,
    payload: ViteTransportPayload,
    options: ViteAssetExplorerOptions = {}
): Promise<void> {
    if (!isRecord(payload) || typeof payload.type !== 'string') {
        return;
    }

    if (payload.type === VITE_ASSET_RPC_LIST_REQUEST) {
        const request = payload as unknown as ViteAssetListRequest;
        channel.post({
            assets: await listViteAssets(root, options),
            requestId: request.requestId,
            type: VITE_ASSET_RPC_LIST_RESPONSE
        } satisfies ViteAssetListResponse);
        return;
    }

    if (payload.type === VITE_ASSET_RPC_READ_REQUEST) {
        const request = payload as unknown as ViteAssetReadRequest;

        try {
            channel.post({
                requestId: request.requestId,
                result: await readViteAssetText(root, request.filePath, {
                    ...options,
                    maxTextBytes: request.maxBytes ?? options.maxTextBytes
                }),
                type: VITE_ASSET_RPC_READ_RESPONSE
            } satisfies ViteAssetReadResponse);
        } catch (error) {
            channel.post({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to read asset content.',
                requestId: request.requestId,
                type: VITE_ASSET_RPC_READ_RESPONSE
            } satisfies ViteAssetReadResponse);
        }
    }
}

export function classifyAsset(filePath: string): ViteAssetKind {
    const extension = extname(filePath).toLowerCase();

    if (imageExtensions.has(extension)) {
        return 'image';
    }

    if (videoExtensions.has(extension)) {
        return 'video';
    }

    if (audioExtensions.has(extension)) {
        return 'audio';
    }

    if (fontExtensions.has(extension)) {
        return 'font';
    }

    if (extension === '.wasm') {
        return 'wasm';
    }

    if (textExtensions.has(extension)) {
        return 'text';
    }

    return 'other';
}

async function collectAssetFiles(rootDir: string): Promise<string[]> {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const filePath = resolve(rootDir, entry.name);

            if (entry.isDirectory()) {
                return excludedDirectoryNames.has(entry.name)
                    ? []
                    : collectAssetFiles(filePath);
            }

            if (!entry.isFile() || excludedFilenames.has(entry.name)) {
                return [];
            }

            return [filePath];
        })
    );

    return files.flat();
}

async function readImageMetadata(
    filePath: string,
    fileStat: { mtimeMs: number; size: number }
): Promise<ViteAssetImageMetadata> {
    const signature = `${fileStat.mtimeMs}:${fileStat.size}`;
    const cached = imageMetadataCache.get(filePath);

    if (cached?.signature === signature) {
        return cached.metadata;
    }

    const metadata = await parseImageMetadata(filePath);
    imageMetadataCache.set(filePath, { metadata, signature });

    return metadata;
}

async function parseImageMetadata(
    filePath: string
): Promise<ViteAssetImageMetadata> {
    const extension = extname(filePath).toLowerCase();

    if (extension === '.svg') {
        return parseSvgMetadata(await readFile(filePath, 'utf8'));
    }

    const buffer = await readFirstBytes(filePath, 512);

    if (isPng(buffer)) {
        return {
            height: buffer.readUInt32BE(20),
            type: 'png',
            width: buffer.readUInt32BE(16)
        };
    }

    if (isGif(buffer)) {
        return {
            height: buffer.readUInt16LE(8),
            type: 'gif',
            width: buffer.readUInt16LE(6)
        };
    }

    const jpeg = parseJpegMetadata(buffer);

    if (jpeg) {
        return jpeg;
    }

    const webp = parseWebpMetadata(buffer);

    if (webp) {
        return webp;
    }

    return { type: 'unknown' };
}

function parseSvgMetadata(svg: string): ViteAssetImageMetadata {
    const width = getSvgNumber(svg, 'width');
    const height = getSvgNumber(svg, 'height');
    const viewBox = svg.match(/viewBox=["']([^"']+)["']/i)?.[1];
    const [, , viewBoxWidth, viewBoxHeight] =
        viewBox?.trim().split(/\s+/).map(Number) ?? [];

    return {
        height: height ?? viewBoxHeight,
        type: 'svg',
        width: width ?? viewBoxWidth
    };
}

function getSvgNumber(svg: string, attribute: string): number | undefined {
    const rawValue = svg.match(
        new RegExp(`${attribute}=["']([0-9.]+)(?:px)?["']`, 'i')
    )?.[1];
    const value = rawValue ? Number(rawValue) : undefined;

    return Number.isFinite(value) ? value : undefined;
}

function parseJpegMetadata(buffer: Buffer): ViteAssetImageMetadata | undefined {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return undefined;
    }

    let offset = 2;

    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            return undefined;
        }

        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);

        if (marker >= 0xc0 && marker <= 0xc3) {
            return {
                height: buffer.readUInt16BE(offset + 5),
                type: 'jpeg',
                width: buffer.readUInt16BE(offset + 7)
            };
        }

        offset += length + 2;
    }

    return { type: 'jpeg' };
}

function parseWebpMetadata(buffer: Buffer): ViteAssetImageMetadata | undefined {
    if (
        buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WEBP'
    ) {
        return undefined;
    }

    const chunkType = buffer.toString('ascii', 12, 16);

    if (chunkType === 'VP8X' && buffer.length >= 30) {
        return {
            height: 1 + buffer.readUIntLE(27, 3),
            type: 'webp',
            width: 1 + buffer.readUIntLE(24, 3)
        };
    }

    return { type: 'webp' };
}

async function readFirstBytes(filePath: string, size: number): Promise<Buffer> {
    return new Promise((resolvePromise, reject) => {
        const chunks: Buffer[] = [];
        const stream = createReadStream(filePath, { end: size - 1 });

        stream.on('data', (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('error', reject);
        stream.on('end', () => {
            resolvePromise(Buffer.concat(chunks));
        });
    });
}

function installAssetWatcher(
    server: ViteDevServer,
    channel: ViteTransportChannel,
    options: ViteAssetExplorerOptions
): void {
    let timeout: NodeJS.Timeout | undefined;
    const debounceMs = options.updateDebounceMs ?? DEFAULT_UPDATE_DEBOUNCE_MS;
    const notify = () => {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            channel.post({ type: VITE_ASSET_UPDATE_EVENT });
        }, debounceMs);
    };

    server.watcher?.on('add', notify);
    server.watcher?.on('change', notify);
    server.watcher?.on('unlink', notify);
}

function getViteAssetPublicPath(_rootDir: string, filePath: string): string {
    return `/@fs/${toPosixPath(filePath)}`;
}

function isInsideRoot(rootDir: string, filePath: string): boolean {
    return filePath === rootDir || filePath.startsWith(`${rootDir}${sep}`);
}

function isPng(buffer: Buffer): boolean {
    return (
        buffer.length >= 24 &&
        buffer[0] === 0x89 &&
        buffer.toString('ascii', 1, 4) === 'PNG'
    );
}

function isGif(buffer: Buffer): boolean {
    return (
        buffer.length >= 10 &&
        ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
    );
}

function toPosixPath(path: string): string {
    return path.split(sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
