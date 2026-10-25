import { spawn } from 'node:child_process';

const server = spawn(
    process.execPath,
    ['docs/recovery/r07/serve-fixture.mjs'],
    { stdio: ['ignore', 'pipe', 'inherit'] }
);
try {
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error('Model fixture startup timed out')),
            30000
        );
        server.stdout.on('data', (data) => {
            if (String(data).includes('R07 fixtures:')) {
                clearTimeout(timeout);
                resolve();
            }
        });
        server.once('exit', (code) => {
            clearTimeout(timeout);
            reject(new Error(`Model fixture exited: ${code}`));
        });
        server.once('error', reject);
    });
    await new Promise((resolve, reject) => {
        const test = spawn(
            process.execPath,
            [
                'docs/recovery/r07/verify-values.mjs',
                'artifacts/r07-values-smoke'
            ],
            { stdio: 'inherit' }
        );
        test.once('error', reject);
        test.once('exit', (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`Model smoke failed: ${code}`))
        );
    });
} finally {
    if (server.exitCode === null && server.signalCode === null) {
        const exited = new Promise((resolve) => server.once('exit', resolve));
        server.kill('SIGTERM');
        await exited;
    }
}
