import { mkdir, copyFile, readFile, writeFile, mkdtemp, rename, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
await mkdir('dist', { recursive: true });
const stage = await mkdtemp(resolve('dist/reference-build-'));
const docs = ['PARTICIPANT_CODEX_PROMPT.md', 'BACKEND_CONNECTION.md', 'PROTOCOL.md', 'GAME_RULES.md', 'PHYSICS_AND_TERRAIN.md', 'WEAPONS.md'];
await copyFile('docs/PARTICIPANT_BRIEF.md', `${stage}/README.md`);
for (const file of docs) await copyFile(`docs/${file}`, `${stage}/${file}`);

// Publish data declarations as documentation, never an executable client package.
const protocol = await readFile('packages/protocol/src/index.ts', 'utf8');
const declarations = protocol.slice(0, protocol.indexOf('export function hull('));
if (!declarations.includes('export interface Timeline') || declarations.includes('export function')) throw Error('Unexpected protocol declaration boundary');
await writeFile(`${stage}/BACKEND_TYPES.md`, `# Backend data shapes\n\nGenerated from protocol v1. This is reference text, not an SDK or an importable package. Constants describe the server rules; implement your own client against these shapes. Snapshot envelopes and transport messages are documented in BACKEND_CONNECTION.md.\n\n\`\`\`ts\n${declarations}\`\`\`\n`);

// Only generated JSON recordings are copied; the simulator and viewer stay with the host.
execFileSync('node_modules/.bin/tsx', ['tools/fixtures.ts'], { stdio: 'inherit' });
await mkdir(`${stage}/examples`);
const examples = ['lobby', 'aiming', 'miss', 'direct-hit', 'self-hit', 'crater', 'scatter', 'cluster', 'drilling', 'settling', 'transition', 'reconnect', 'draw'];
for (const name of examples) await copyFile(`dist/fixtures/${name}.json`, `${stage}/examples/${name}.json`);
await writeFile(`${stage}/examples/README.md`, '# Recorded backend data\n\nThese labeled JSON fixtures contain a public state, terrainBase64 and a simulation timeline for visual experiments. They are not live rooms or complete wire transcripts. Decode terrainBase64 to the 73,728 packed bytes described in BACKEND_CONNECTION.md. Live snapshot messages carry binary bytes rather than base64. Timeline start=0 is a fixture-relative time; rebase it to your preview clock. The state is a base scene and may not be in playback phase; for lobby/aiming/draw previews ignore the timeline. Match IDs, seats, seeds and room codes are examples only. Do not submit them to the deployed backend. No viewer, SDK, server or frontend is included.\n');

await mkdir('dist/downloads', { recursive: true });
// zip updates existing archives, so assemble a fresh one before replacing the download.
const temporaryZip = `${stage}/reference.zip`;
execFileSync('zip', ['-q', '-r', temporaryZip, 'README.md', ...docs, 'BACKEND_TYPES.md', 'examples'], { cwd: stage, stdio: 'inherit' });
const entries = execFileSync('unzip', ['-Z1', temporaryZip], { encoding: 'utf8' }).trim().split('\n');
if (entries.some(name => !name.endsWith('/') && !/\.(md|json)$/.test(name))) throw Error('Reference pack contains an executable asset');
await rename(temporaryZip, resolve('dist/downloads/artillery-lab-backend-reference.zip'));

// Retire the previous generated attendee download without deleting the local archive.
const oldZip = resolve('dist/downloads/artillery-lab-starter.zip');
try { await access(oldZip); await rename(oldZip, `${stage}/retired-starter.zip`); console.log(`Previous starter preserved outside downloads: ${stage}/retired-starter.zip`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(`Backend reference ZIP: dist/downloads/artillery-lab-backend-reference.zip (${entries.filter(n => !n.endsWith('/')).length} documentation/data files; no SDK, frontend or backend runtime)`);
