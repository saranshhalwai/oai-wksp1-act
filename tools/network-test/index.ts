import net from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pair, shotPair } from '../load-test/clients';
const target = new URL(process.env.BACKEND_URL ?? 'http://localhost:2567');
if (target.protocol !== 'http:') throw Error('TCP delay harness expects a local HTTP/WS backend. Use external venue RTT tools separately.');
const reports: unknown[] = [];
for (const rtt of [20, 60, 150, 300]) {
  const sockets = new Set<net.Socket>();
  const proxy = net.createServer(client => { const remote = net.connect(Number(target.port || 80), target.hostname); sockets.add(client); sockets.add(remote);
    const forward = (from: net.Socket, to: net.Socket) => { let previous = performance.now(); const timers = new Set<NodeJS.Timeout>(); let packet = 0; from.on('data', data => { const delay = rtt / 2 + (++packet % 17 === 0 ? 40 : 0), due = Math.max(previous, performance.now() + delay); previous = due; const timer = setTimeout(() => { timers.delete(timer); if (!to.destroyed) to.write(data); }, due-performance.now()); timers.add(timer); if (timers.size > 512) { from.destroy(); to.destroy(); } }); from.on('close', () => { for (const timer of timers) clearTimeout(timer); to.destroy(); sockets.delete(from); }); from.on('error', () => to.destroy()); }; forward(client,remote); forward(remote,client);
  });
  await new Promise<void>(r => proxy.listen(2780,'127.0.0.1',r));
  const [a,b] = await pair('http://127.0.0.1:2780');
  try { await shotPair(a,b,0); reports.push({ injectedRttMs: rtt, perDirectionMs: rtt/2, burstJitterMs: 40, measuredRtts: [...a.rtts,...b.rtts], ackMs: [...a.acks,...b.acks], checksum: a.state.checksum, converged: a.state.checksum === b.state.checksum, errors: [...a.errors,...b.errors] }); }
  finally { await a.close(); await b.close(); for (const s of sockets) s.destroy(); await new Promise<void>(r => proxy.close(() => r())); }
}
mkdirSync('test-results',{recursive:true}); writeFileSync('test-results/network-report.json',JSON.stringify(reports,null,2)); console.log(JSON.stringify(reports,null,2));
