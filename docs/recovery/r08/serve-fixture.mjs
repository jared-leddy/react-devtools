import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const directory = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.resolve('artifacts/r08-fixture-'));
const source = fs.readFileSync(path.join(directory, 'fixture.tsx'), 'utf8');
const update = (version) =>
    fs.writeFileSync(
        path.join(temporary, 'App.tsx'),
        source.replace('R08_VERSION', version)
    );
update('v1');
fs.writeFileSync(
    path.join(temporary, 'index.html'),
    `<!doctype html><html><head><title>R08 lifecycle</title></head><body><button id="start-app">Start app root</button><button id="remove-app">Remove app root</button><button id="restore-app">Restore app root</button><div id="app"></div><script type="module" src="/main.tsx"></script></body></html>`
);
fs.writeFileSync(
    path.join(temporary, 'main.tsx'),
    `import React from 'react';import{createRoot}from'react-dom/client';import App from './App';const marker=new URL(location.href).searchParams.get('name')??'A';let root;function mount(){root=createRoot(document.getElementById('app'));root.render(<App marker={marker}/>);}if(!new URL(location.href).searchParams.has('defer'))mount();document.getElementById('start-app').onclick=()=>{if(!root)mount();};document.getElementById('remove-app').onclick=()=>{root?.unmount();root=undefined;};document.getElementById('restore-app').onclick=()=>{if(!root)mount();};if(!new URL(location.href).searchParams.has('nested')){const frame=document.createElement('iframe');frame.id='child';frame.src='/?name=FRAME&nested=1';document.body.append(frame);}`
);
const server = await createServer({
    root: temporary,
    configFile: false,
    plugins: [
        react(),
        {
            name: 'lifecycle-control',
            configureServer(server) {
                server.middlewares.use('/__r08/update', (request, response) => {
                    const value = new URL(
                        request.url,
                        'http://127.0.0.1'
                    ).searchParams.get('version');
                    if (!value || !/^v[\w-]+$/.test(value)) {
                        response.statusCode = 400;
                        response.end();
                        return;
                    }
                    update(value);
                    response.end(value);
                });
            }
        }
    ],
    server: { host: '127.0.0.1', port: 9057, strictPort: true },
    cacheDir: path.join(temporary, '.vite')
});
await server.listen();
console.log('R08 fixtures: http://127.0.0.1:9057/?name=A');
async function close() {
    await server.close();
    fs.rmSync(temporary, { recursive: true, force: true });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
