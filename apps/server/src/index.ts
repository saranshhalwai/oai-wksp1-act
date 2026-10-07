import { Server, Room, type Client } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { randomInt } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { appendFileSync, mkdirSync } from 'node:fs';
import { GameEngine } from './engine';
import { WorkerPool } from './pool';
import { MODES, VERSION, type Command, type Mode } from '../../../packages/protocol/src/index';
import { pack } from '../../../packages/terrain/src/index';
const origins = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://localhost:8080').split(',').filter(Boolean));
const pool = new WorkerPool(Number(process.env.PHYSICS_WORKERS ?? 1), Number(process.env.WORKER_QUEUE_LIMIT ?? 32));
const rooms = new Map<string, BattleRoom>(); let draining = false, bytes = 0, reconnects = 0;
const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable();
function log(event: string, data: Record<string, unknown> = {}) { const line = JSON.stringify({ timestamp: new Date().toISOString(), severity: 'INFO', event, build: process.env.BUILD_ID ?? 'local', ...data }); console.log(line); if (process.env.LOG_DIR) { mkdirSync(process.env.LOG_DIR, { recursive: true }); appendFileSync(`${process.env.LOG_DIR}/game.jsonl`, line + '\n'); } }
const PublicState = schema({ snapshot: t.string() });
class BattleRoom extends Room<{ state: InstanceType<typeof PublicState> }> {
  engine!: GameEngine; created = Date.now();
  onCreate(options: { mode?: Mode; practice?: boolean }) {
    if (draining || rooms.size >= Number(process.env.MAX_ROOMS ?? 50)) throw Error('Room admission paused');
    if (options.mode && !Object.hasOwn(MODES, options.mode)) throw Error('Unknown mode');
    this.maxClients = 2; this.maxMessagesPerSecond = 40; this.autoDispose = false; this.state = new PublicState();
    let code = ''; do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join(''); } while (rooms.has(code));
    this.roomId = code; rooms.set(code, this);
    this.engine = new GameEngine({ code, mode: options.mode ?? 'workshop-quick', practice: options.practice === true, simulate: input => pool.run(input), publish: (type, data) => {
      if (type === 'state') { this.state.snapshot = JSON.stringify(data); bytes += this.state.snapshot.length * this.clients.length; }
      else if (type === 'reset') { this.clock.setTimeout(() => this.clients.forEach(c => this.snapshot(c)), 0); }
      else { bytes += JSON.stringify(data).length * this.clients.length; this.broadcast(type, data); }
    } });
    this.onMessage('command', (client, c: Command) => { if (!c || typeof c !== 'object' || JSON.stringify(c).length > 2048) { client.send('ack', { id: '', ok: false, error: 'Malformed command', serverTime: Date.now() }); return; } const slot = this.engine.state.players.findIndex(p => p.id === client.sessionId); client.send('ack', this.engine.command(slot, c)); });
    this.onMessage('resync', client => this.snapshot(client));
    this.onMessage('ping', (client, data) => { if (typeof data === 'number' && Number.isFinite(data)) client.send('pong', { echo: data, serverTime: Date.now() }); });
    this.onMessage('*', () => {});
    this.clock.setInterval(() => { this.engine.tick(); if ((this.engine.state.result && !this.clients.length) || Date.now() - this.created > 45 * 60 * 1000 || (this.engine.state.phase === 'waiting' && Date.now() - this.created > 10 * 60 * 1000)) void this.disconnect(); }, 25);
    log('room-created', { room: code, mode: this.engine.state.mode });
  }
  onJoin(client: Client, options: { displayName?: string }) {
    if (typeof options.displayName !== 'string' || options.displayName.length > 24) throw Error('Name must be 1–24 characters');
    this.engine.addPlayer(client.sessionId, options.displayName);
    if (this.engine.state.practice) this.engine.addPlayer('practice-bot', 'Practice bot', true);
    if (this.engine.state.players.length === 2) void this.lock();
    this.snapshot(client);
  }
  snapshot(client: Client) { const packet = { state: this.engine.state, terrain: pack(this.engine.mask), timeline: this.engine.timeline, serverTime: Date.now() }; bytes += 73728; client.send('snapshot', packet); }
  async onDrop(client: Client) { const slot = this.engine.state.players.findIndex(p => p.id === client.sessionId); if (slot < 0) return; this.engine.disconnect(slot); try { await this.allowReconnection(client, 20); } catch { /* Engine owns terminal policy, including in-flight shots. */ } }
  onReconnect(client: Client) { const slot = this.engine.state.players.findIndex(p => p.id === client.sessionId); this.engine.connect(slot); reconnects++; this.snapshot(client); }
  onLeave(client: Client) { const slot = this.engine.state.players.findIndex(p => p.id === client.sessionId); if (slot >= 0 && this.engine.state.players[slot].connected) this.engine.disconnect(slot, true); }
  onDispose() { this.engine.abort('Room closed'); rooms.delete(this.roomId); log('room-closed', { room: this.roomId }); }
}
const transport = new WebSocketTransport({ maxPayload: 16384, verifyClient: (info: { origin: string }) => !info.origin || origins.has(info.origin) });
const server = new Server({ transport, greet: false, gracefullyShutdown: false, express: app => {
  app.use((req, res, next) => { const origin = req.headers.origin; if (origin && !origins.has(origin)) { res.status(403).json({ error: 'Origin not allowed' }); return; } if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); } if (req.method === 'OPTIONS') { res.sendStatus(204); return; } next(); });
  let windowAt = Date.now(), creates = 0;
  app.use((req, res, next) => { if (req.method === 'POST' && req.path.includes('/create/')) { if (Date.now() - windowAt > 60000) { creates = 0; windowAt = Date.now(); } if (++creates > 300 || draining) { res.status(429).json({ error: 'Room creation temporarily limited' }); return; } } next(); });
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', (_req, res) => res.status(draining ? 503 : 200).json({ ready: !draining }));
  app.get('/version', (_req, res) => res.json({ ...VERSION, build: process.env.BUILD_ID ?? 'local' }));
  app.get('/internal/metrics', (req, res) => { if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) { res.sendStatus(403); return; } const active = [...rooms.values()].filter(r => !r.engine.state.result).length;
    res.json({ rooms: rooms.size, active, players: [...rooms.values()].reduce((n, r) => n + r.clients.length, 0), workerBusy: pool.busy, workerQueue: pool.queued, ...pool.metrics, eventLoopP95Ms: lag.percentile(95) / 1e6, outgoingBytes: bytes, reconnects, memory: process.memoryUsage() }); });
  app.post('/internal/drain', (req, res) => { if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) { res.sendStatus(403); return; } draining = true; if (req.query.force === 'true') rooms.forEach(r => r.engine.abort('Operator forced drain')); res.json({ draining }); });
} });
server.define('battle', BattleRoom);
await server.listen(Number(process.env.PORT ?? 2567), process.env.HOST ?? '0.0.0.0');
// Colyseus binds matchmaking before Express middleware. Gate the HTTP listener
// itself so Origin/admission limits also cover bootstrap and OPTIONS requests.
const httpServer = transport.server!;
const httpHandlers = httpServer.listeners('request');
httpServer.removeAllListeners('request');
let admissionWindow = Date.now(), admissions = 0;
httpServer.on('request', (req, res) => {
  const origin = req.headers.origin;
  if (origin && !origins.has(origin)) { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Origin not allowed' })); return; }
  if (Number(req.headers['content-length'] ?? 0) > 16384) { res.writeHead(413); res.end(); return; }
  if (req.method === 'POST' && /\/matchmake\/(create|joinOrCreate)\//.test(req.url ?? '')) {
    if (Date.now() - admissionWindow > 60000) { admissionWindow = Date.now(); admissions = 0; }
    if (draining || ++admissions > 300) { res.writeHead(429, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Room admission limited' })); return; }
  }
  for (const handler of httpHandlers) handler.call(httpServer, req, res);
});
log('server-ready', { port: Number(process.env.PORT ?? 2567), versions: VERSION });
const report = setInterval(() => { log('metrics', { rooms: rooms.size, workerQueue: pool.queued, workerBusy: pool.busy, workerErrors: pool.metrics.errors, eventLoopP95Ms: lag.percentile(95) / 1e6, outgoingBytes: bytes }); lag.reset(); }, 30000);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; draining = true; log('shutdown-draining'); const end = Date.now() + 30000; while ([...rooms.values()].some(r => !r.engine.state.result) && Date.now() < end) await new Promise(r => setTimeout(r, 200)); rooms.forEach(r => r.engine.abort('Server shutdown')); clearInterval(report); await pool.close(); await server.gracefullyShutdown(false); process.exit(0); }
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
