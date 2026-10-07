import { Client, type Room } from '@colyseus/sdk';
import { randomUUID } from 'node:crypto';
import type { GameState, Command, Ack, Mode } from '../../packages/protocol/src/index';
import { unpack, checksum, applyPatch } from '../../packages/terrain/src/index';
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function until(test: () => boolean, timeout = 20000) { const end = Date.now() + timeout; while (!test()) { if (Date.now() > end) throw Error('Timed out waiting for room state'); await sleep(20); } }
export class Headless {
  state!: GameState; mask?: Uint8Array; version = -1; acks: number[] = []; rtts: number[] = []; errors: string[] = []; bytes = 0;
  private pending = new Map<string, { at: number; resolve: (a: Ack) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  constructor(public room: Room) {
    room.onStateChange((s: { snapshot: string }) => { if (s.snapshot) { this.state = JSON.parse(s.snapshot); this.bytes += s.snapshot.length; } });
    room.onMessage('snapshot', (s: { state: GameState; terrain: Uint8Array }) => { this.state = s.state; this.mask = unpack(new Uint8Array(s.terrain)); this.version = s.state.terrainVersion; if (checksum(this.mask) !== s.state.checksum) this.errors.push('Snapshot checksum mismatch'); this.bytes += 73728; });
    room.onMessage('patch', p => { try { this.mask = applyPatch(this.mask!, this.version, p); this.version = p.newVersion; } catch (e) { this.errors.push((e as Error).message); room.send('resync'); } });
    room.onMessage('ack', (a: Ack) => { const p = this.pending.get(a.id); if (!p) return; clearTimeout(p.timer); this.pending.delete(a.id); this.acks.push(performance.now() - p.at); p.resolve(a); });
    room.onMessage('pong', (p: { echo: number }) => this.rtts.push(performance.now() - p.echo));
    room.onMessage('timeline', t => { this.bytes += JSON.stringify(t).length; }); room.onMessage('server-error', e => this.errors.push(JSON.stringify(e)));
    room.onError((code, message) => this.errors.push(`${code}: ${message}`)); room.send('resync');
  }
  get slot() { return this.state.players.findIndex(p => p.id === this.room.sessionId); }
  ping() { this.room.send('ping', performance.now()); }
  command(type: Command['type'], data?: unknown, overrides: Partial<Command> = {}) {
    const c: Command = { v: 1, id: randomUUID(), matchId: this.state.matchId, turnId: this.state.turnId, type, data, ...overrides };
    return new Promise<Ack>((resolve, reject) => { this.pending.set(c.id, { at: performance.now(), resolve, reject, timer: setTimeout(() => { this.pending.delete(c.id); reject(Error('Ack timeout')); }, 10000) }); this.room.send('command', c); });
  }
  async close() { for (const p of this.pending.values()) clearTimeout(p.timer); this.pending.clear(); await this.room.leave(); }
}
export async function pair(url: string, mode: Mode = 'workshop-quick') { const transport = new Client(url); const a = new Headless(await transport.create('battle', { displayName: 'Load A', mode })); await until(() => !!a.state); const b = new Headless(await transport.joinById(a.state.roomCode, { displayName: 'Load B' })); await until(() => !!b.state && a.state.players.length === 2); await a.command('ready', true); await b.command('ready', true); return [a, b] as const; }
export async function shotPair(a: Headless, b: Headless, index: number) { await until(() => a.state.phase === 'aiming' && b.state.phase === 'aiming'); const shooter = a.state.active === a.slot ? a : b, p = shooter.state.players[shooter.slot]; const weapon = (['cluster', 'borer', 'scatter', 'heavy', 'standard'] as const).find(w => p.ammo[w] > 0)!;
  a.ping(); b.ping(); const aim = { angle: shooter.slot ? 125 : 55, power: 65, weapon }; const aimAck = await shooter.command('aim', { ...aim, seq: index + 1 }); if (!aimAck.ok) throw Error(aimAck.error); const ack = await shooter.command('fire', aim); if (!ack.ok) throw Error(ack.error);
  const version = a.state.terrainVersion; await until(() => a.state.terrainVersion > version && b.state.terrainVersion > version, 20000); if (a.state.checksum !== b.state.checksum || checksum(a.mask!) !== a.state.checksum || checksum(b.mask!) !== b.state.checksum) throw Error('Clients diverged');
}
