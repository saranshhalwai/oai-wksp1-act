import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';
await build({ entryPoints: ['apps/server/src/index.ts', 'apps/server/src/worker.ts'], outdir: 'dist/server', bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const backend = spawn(process.execPath, ['--watch', 'dist/server/index.js'], { stdio: 'inherit' });
const servers = [];
for (const [app, port, base] of [['neon-client', 5173, '/neon/'], ['paper-client', 5174, '/paper/']]) {
  const server = await createServer({ root: `apps/${app}`, base, server: { host: '0.0.0.0', port, strictPort: true } }); await server.listen(); servers.push(server); server.printUrls();
}
async function stop() { backend.kill('SIGTERM'); await Promise.all(servers.map(s => s.close())); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
