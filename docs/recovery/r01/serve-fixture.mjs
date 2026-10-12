import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'react-devtools-r01-'));
const bundle = path.join(output, 'fixture.js');

await build({
    entryPoints: [path.join(directory, 'fixture.tsx')],
    outfile: bundle,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"' }
});

const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(fs.readFileSync(bundle));
        return;
    }

    response.setHeader('Content-Type', 'text/html');
    if (request.url === '/non-react') {
        response.end(
            '<!doctype html><html><title>R01 non-React control</title><body><h1>R01 non-React control</h1><p>No React renderer.</p></body></html>'
        );
        return;
    }

    if (request.url !== '/react') {
        response.statusCode = 404;
        response.end('Not found');
        return;
    }

    response.end(
        '<!doctype html><html><title>R01 unannotated React baseline</title><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
    );
});

server.listen(9051, '127.0.0.1', () => {
    console.log('React baseline: http://127.0.0.1:9051/react');
    console.log('Non-React control: http://127.0.0.1:9051/non-react');
});

function close() {
    server.close(() => fs.rmSync(output, { recursive: true, force: true }));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
