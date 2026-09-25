import type { SourceMapInput } from 'rollup';

export const DEFAULT_SOURCE_METADATA_ATTRIBUTE = 'data-react-devtools-source';

export interface SourceMetadataOptions {
    attributeName?: string;
    exclude?: RegExp | string;
    include?: RegExp | string;
}

export interface SourceMetadataTransformResult {
    code: string;
    map: SourceMapInput;
}

interface JsxOpeningTag {
    insertAt: number;
    sourceOffset: number;
    tagName: string;
}

interface SourcePosition {
    columnNumber: number;
    lineNumber: number;
}

export function shouldTransformSourceMetadata(
    id: string,
    options: false | SourceMetadataOptions | undefined
): boolean {
    if (options === false) {
        return false;
    }

    const [filename] = id.split('?', 2);

    if (!/\.[cm]?[jt]sx$/.test(filename)) {
        return false;
    }

    if (matchesPattern(options?.exclude, filename)) {
        return false;
    }

    return options?.include ? matchesPattern(options.include, filename) : true;
}

export function transformReactSourceMetadata(
    code: string,
    id: string,
    options: SourceMetadataOptions = {}
): SourceMetadataTransformResult | undefined {
    const attributeName =
        options.attributeName ?? DEFAULT_SOURCE_METADATA_ATTRIBUTE;
    const tags = findJsxOpeningTags(code, attributeName);

    if (tags.length === 0) {
        return undefined;
    }

    let transformed = code;

    for (let index = tags.length - 1; index >= 0; index -= 1) {
        const tag = tags[index]!;
        const position = getSourcePosition(code, tag.sourceOffset);
        const source = encodeSourceLocation({
            columnNumber: position.columnNumber,
            fileName: normalizeSourceFileName(id),
            lineNumber: position.lineNumber
        });

        transformed = `${transformed.slice(0, tag.insertAt)} ${attributeName}="${source}"${transformed.slice(tag.insertAt)}`;
    }

    return {
        code: transformed,
        map: createIdentitySourceMap(id, code)
    };
}

function findJsxOpeningTags(
    code: string,
    attributeName: string
): JsxOpeningTag[] {
    const tags: JsxOpeningTag[] = [];
    let index = 0;
    let state: 'code' | 'double' | 'line-comment' | 'single' | 'template' =
        'code';

    while (index < code.length) {
        const char = code[index];
        const next = code[index + 1];

        if (state === 'line-comment') {
            state = char === '\n' ? 'code' : state;
            index += 1;
            continue;
        }

        if (state !== 'code') {
            if (char === '\\') {
                index += 2;
                continue;
            }

            if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            ) {
                state = 'code';
            }

            index += 1;
            continue;
        }

        if (char === '/' && next === '/') {
            state = 'line-comment';
            index += 2;
            continue;
        }

        if (char === '/' && next === '*') {
            const commentEnd = code.indexOf('*/', index + 2);
            index = commentEnd === -1 ? code.length : commentEnd + 2;
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            state =
                char === "'" ? 'single' : char === '"' ? 'double' : 'template';
            index += 1;
            continue;
        }

        if (
            char === '<' &&
            isJsxTagStart(next) &&
            isLikelyJsxStart(code, index)
        ) {
            const parsed = parseJsxOpeningTag(code, index, attributeName);

            if (parsed) {
                tags.push(parsed);
                index = parsed.insertAt + 1;
                continue;
            }
        }

        index += 1;
    }

    return tags;
}

function parseJsxOpeningTag(
    code: string,
    start: number,
    attributeName: string
): JsxOpeningTag | undefined {
    const nameStart = start + 1;
    let nameEnd = nameStart;

    while (isJsxNameChar(code[nameEnd])) {
        nameEnd += 1;
    }

    const tagName = code.slice(nameStart, nameEnd);

    if (tagName.length === 0 || tagName === 'Fragment') {
        return undefined;
    }

    let index = nameEnd;
    let braceDepth = 0;
    let quote: null | string = null;

    while (index < code.length) {
        const char = code[index];
        if (quote) {
            if (char === '\\') {
                index += 2;
                continue;
            }

            if (char === quote) {
                quote = null;
            }

            index += 1;
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            index += 1;
            continue;
        }

        if (char === '{') {
            braceDepth += 1;
            index += 1;
            continue;
        }

        if (char === '}') {
            braceDepth = Math.max(0, braceDepth - 1);
            index += 1;
            continue;
        }

        if (braceDepth === 0 && char === '>') {
            const insertAt = nextTagInsertOffset(code, index);
            const openingSource = code.slice(start, index);

            if (openingSource.includes(attributeName)) {
                return undefined;
            }

            return { insertAt, sourceOffset: nameStart, tagName };
        }

        index += 1;
    }

    return undefined;
}

function nextTagInsertOffset(code: string, closeOffset: number): number {
    let insertAt = closeOffset;

    while (insertAt > 0 && /\s/.test(code[insertAt - 1]!)) {
        insertAt -= 1;
    }

    if (code[insertAt - 1] !== '/') {
        return insertAt;
    }

    insertAt -= 1;

    while (insertAt > 0 && /\s/.test(code[insertAt - 1]!)) {
        insertAt -= 1;
    }

    return insertAt;
}

function getSourcePosition(code: string, offset: number): SourcePosition {
    let lineNumber = 1;
    let columnNumber = 1;

    for (let index = 0; index < offset; index += 1) {
        if (code[index] === '\n') {
            lineNumber += 1;
            columnNumber = 1;
        } else {
            columnNumber += 1;
        }
    }

    return { columnNumber, lineNumber };
}

function encodeSourceLocation(source: {
    columnNumber: number;
    fileName: string;
    lineNumber: number;
}): string {
    return [
        source.fileName,
        source.lineNumber.toString(),
        source.columnNumber.toString()
    ].join(':');
}

function createIdentitySourceMap(id: string, source: string): SourceMapInput {
    const lineCount = source.split('\n').length;

    return {
        mappings: Array.from({ length: lineCount }, (_, index) =>
            index === 0 ? 'AAAA' : 'AACA'
        ).join(';'),
        names: [],
        sources: [normalizeSourceFileName(id)],
        sourcesContent: [source],
        version: 3
    };
}

function matchesPattern(
    pattern: RegExp | string | undefined,
    filename: string
): boolean {
    if (!pattern) {
        return false;
    }

    return typeof pattern === 'string'
        ? filename.includes(pattern)
        : pattern.test(filename);
}

function normalizeSourceFileName(id: string): string {
    return id.split('?', 2)[0]!;
}

function isJsxTagStart(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z]/.test(char));
}

function isJsxNameChar(char: string | undefined): boolean {
    return Boolean(char && /[A-Za-z0-9_$:.-]/.test(char));
}

function isLikelyJsxStart(code: string, offset: number): boolean {
    let index = offset - 1;

    while (index >= 0 && /\s/.test(code[index]!)) {
        index -= 1;
    }

    if (index < 0) {
        return true;
    }

    const previous = code[index]!;

    if (!/[A-Za-z0-9_$]/.test(previous)) {
        return true;
    }

    let tokenStart = index;

    while (tokenStart >= 0 && /[A-Za-z0-9_$]/.test(code[tokenStart]!)) {
        tokenStart -= 1;
    }

    const token = code.slice(tokenStart + 1, index + 1);

    return token === 'return' || token === 'yield' || token === 'case';
}
