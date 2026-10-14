import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'react-devtools-r04-'));
const bundle = path.join(temporary, 'fixture.js');
await build({
    entryPoints: [path.join(directory, 'fixture.tsx')],
    outfile: bundle,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' }
});
const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(fs.readFileSync(bundle));
        return;
    }
    response.setHeader('Content-Type', 'text/html');
    response.end(
        '<!doctype html><html><title>R04 React commit fixture</title><body><div id="root"></div><div id="secondary"></div><script src="/fixture.js"></script></body></html>'
    );
});
server.listen(9053, '127.0.0.1', () =>
    console.log('R04 fixture: http://127.0.0.1:9053/react')
);
function close() {
    server.close(() => fs.rmSync(temporary, { recursive: true, force: true }));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
