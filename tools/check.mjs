import { readFileSync } from 'node:fs';
for (const path of ['apps/neon-client/src/renderer.ts', 'apps/paper-client/src/renderer.ts', 'packages/client-sdk/src/index.ts']) {
  if (/from .*packages\/physics/.test(readFileSync(path, 'utf8'))) throw Error(`Server physics leaked into public client: ${path}`);
}
console.log('Client authority boundary checks passed.');
