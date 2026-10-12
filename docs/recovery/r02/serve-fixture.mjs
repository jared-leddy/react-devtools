import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'react-devtools-r02-'));
const bundle = path.join(output, 'fixture.js');
await build({
    entryPoints: [path.join(directory, 'native-fixture.tsx')],
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
    if (request.url !== '/react') {
        response.statusCode = 404;
        response.end('Not found');
        return;
    }
    response.end(
        '<!doctype html><html><title>R02 wrapped React comparison</title><body><div id="root"></div><script src="/fixture.js"></script></body></html>'
    );
});
server.listen(9052, '127.0.0.1', () => {
    console.log('React comparison: http://127.0.0.1:9052/react');
});
function close() {
    server.close(() => fs.rmSync(output, { recursive: true, force: true }));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
