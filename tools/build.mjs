import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await mkdir('dist/server', { recursive: true });
await build({ entryPoints: ['apps/server/src/index.ts', 'apps/server/src/worker.ts'], outdir: 'dist/server', bundle: true, platform: 'node', format: 'esm', packages: 'external', sourcemap: true });
if (process.argv.includes('--server-only')) process.exit(0);
for (const app of ['neon', 'paper']) {
  await viteBuild({ root: `apps/${app}-client`, base: `/${app}/`, build: { outDir: `../../dist/${app}`, emptyOutDir: true } });
}
await copyFile('apps/landing.html', 'dist/index.html');
await writeFile('dist/version.json', JSON.stringify({ build: process.env.BUILD_ID ?? 'local', protocol: 1, rules: 1, physics: 1 }));
