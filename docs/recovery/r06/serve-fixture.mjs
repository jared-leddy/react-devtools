import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'react-devtools-r06-'));
for (const mode of ['development', 'production'])
    await build({
        entryPoints: [path.join(directory, 'fixture.tsx')],
        outfile: path.join(temporary, `${mode}.js`),
        bundle: true,
        platform: 'browser',
        format: 'iife',
        jsx: 'automatic',
        minify: mode === 'production',
        define: { 'process.env.NODE_ENV': JSON.stringify(mode) }
    });
const root = path.resolve(directory, '../../..');
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:9055');
    const asset = url.pathname.startsWith('/client/')
        ? path.join(
              root,
              'packages/devtools-client/dist/standalone',
              url.pathname.slice(8) || 'index.html'
          )
        : url.pathname.startsWith('/overlay/')
          ? path.join(
                root,
                'packages/devtools-overlay/dist',
                url.pathname.slice(9)
            )
          : /^\/(development|production)\.js$/.test(url.pathname)
            ? path.join(temporary, url.pathname.slice(1))
            : undefined;
    if (asset) {
        if (!asset.startsWith(root) && !asset.startsWith(temporary)) {
            response.writeHead(403).end();
            return;
        }
        try {
            response.setHeader(
                'Content-Type',
                asset.endsWith('.js')
                    ? 'application/javascript'
                    : asset.endsWith('.css')
                      ? 'text/css'
                      : 'text/html'
            );
            response.end(fs.readFileSync(asset));
        } catch {
            response.writeHead(404).end();
        }
        return;
    }
    const mode = url.pathname.includes('production')
        ? 'production'
        : 'development';
    const overlay = url.searchParams.has('overlay');
    response.setHeader('Content-Type', 'text/html');
    response.end(
        `<!doctype html><html><head><title>R06 ${mode}</title>${overlay ? '<script src="/overlay/prepare.js"></script><link rel="stylesheet" href="/overlay/devtools-overlay.css">' : ''}</head><body><nav><button id="remove-primary">Remove primary root</button><button id="restore-primary">Restore primary root</button><button id="remove-secondary">Remove secondary root</button><button id="restore-secondary">Restore secondary root</button></nav><div id="app"></div><div id="secondary"></div><div id="portal"></div><script src="/${mode}.js"></script>${overlay ? '<script type="module" src="/overlay/devtools-overlay.js" data-react-devtools-client-url="/client/"></script>' : ''}</body></html>`
    );
});
server.listen(9055, '127.0.0.1', () =>
    console.log('R06 fixtures: http://127.0.0.1:9055/development?overlay')
);
function close() {
    server.close(() => fs.rmSync(temporary, { recursive: true, force: true }));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
