import { cpus, totalmem, hostname } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pair, shotPair, sleep } from './clients';
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=');
const url = arg('url') ?? process.env.BACKEND_URL ?? 'http://localhost:2567', count = Number(arg('rooms') ?? process.env.ROOMS ?? 50), duration = Number(arg('duration') ?? process.env.DURATION_SECONDS ?? 900), warmup = Number(arg('warmup') ?? process.env.WARMUP_SECONDS ?? 20);
const q = (a: number[], p: number) => a.length ? [...a].sort((a,b) => a-b)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const started = Date.now(), end = started + (duration + warmup) * 1000, acks: number[] = [], rtts: number[] = [], errors: string[] = []; let shots = 0, matches = 0, bytes = 0;
console.log(JSON.stringify({ event: 'load-start', url, count, duration, warmup, generator: hostname(), cpus: cpus().length }));
await Promise.all(Array.from({ length: count }, async (_, i) => {
  await sleep(i * 30);
  while (Date.now() < end) {
    let clients: Awaited<ReturnType<typeof pair>> | undefined;
    try { clients = await pair(url, 'standard'); const [a,b] = clients; matches++; for (let shot = 0; shot < 20 && Date.now() < end; shot++) { await shotPair(a,b,shot); if (Date.now() >= started + warmup * 1000) shots++; } acks.push(...a.acks, ...b.acks); rtts.push(...a.rtts,...b.rtts); bytes += a.bytes + b.bytes; errors.push(...a.errors,...b.errors); }
    catch (e) { errors.push((e as Error).message); }
    finally { if (clients) await Promise.all(clients.map(c => c.close().catch(() => {}))); await sleep(150); }
  }
}));
let metrics: unknown = null; try { const res = await fetch(`${url}/internal/metrics`); if (res.ok) metrics = await res.json(); } catch { /* Remote private metrics collected separately. */ }
const report = { at: new Date().toISOString(), backend: url, generator: { hostname: hostname(), platform: process.platform, node: process.version, cpu: cpus()[0].model, cores: cpus().length, ramGiB: totalmem() / 2 ** 30 }, requestedRooms: count, requestedDurationSeconds: duration, warmupSeconds: warmup, actualSeconds: (Date.now()-started)/1000, matches, shotsAfterWarmup: shots, ackP50: q(acks,.5), ackP95: q(acks,.95), rttP50: q(rtts,.5), rttP95: q(rtts,.95), approximateIncomingBytes: bytes, errors, metrics, limitation: 'Generator-local measurements. Capacity claims require a separate generator and deployed VM host metrics. Ack/RTT samples include warmup; shot count excludes warmup.' };
mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/load-report.json', JSON.stringify(report,null,2)); console.log(JSON.stringify({ ...report, errors: { count: errors.length, examples: [...new Set(errors)] }, metrics: metrics ? { ...(metrics as object), calculation: 'see report file', queueWait: 'see report file' } : null },null,2)); if (errors.length) process.exitCode=1;
