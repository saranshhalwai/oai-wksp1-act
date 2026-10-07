import { randomUUID, randomInt } from 'node:crypto';
import { MODES, VERSION, validAim, type GameState, type Player, type Mode, type Command, type Ack, type Timeline, type Aim, type Weapon } from '../../../packages/protocol/src/index';
import { generateTerrain, checksum, settle, moveTank } from '../../../packages/terrain/src/index';
import { type ShotInput, type ShotResult } from '../../../packages/physics/src/index';
export interface EngineOptions { code: string; mode: Mode; practice?: boolean; seed?: number; now?: () => number; countdownMs?: number; graceMs?: number; turnMs?: number; playbackScale?: number; simulate: (input: ShotInput) => Promise<ShotResult>; publish: (type: string, data: unknown) => void }
export class GameEngine {
  state: GameState;
  mask: Uint8Array;
  timeline: Timeline | null = null;
  private result: ShotResult | null = null;
  private cache = new Map<string, { fingerprint: string; ack: Ack }>();
  private absent = new Map<number, number>();
  private rematch = new Set<number>();
  private aimSeq = new Map<number, number>();
  private botAt = 0;
  private now: () => number;
  constructor(private options: EngineOptions) {
    this.now = options.now ?? Date.now;
    const seed = options.seed ?? randomInt(0x7fffffff); this.mask = generateTerrain(seed);
    this.state = { versions: VERSION, build: process.env.BUILD_ID ?? 'local', roomCode: options.code, matchId: randomUUID(), turnId: 0, mode: options.mode, phase: 'waiting', players: [], tanks: [settle(this.mask, { x: 140, y: 250, slot: 0 }), settle(this.mask, { x: 884, y: 250, slot: 1 })], active: 0, first: randomInt(2), round: 0, wind: 0, deadline: 0, terrainVersion: 0, checksum: checksum(this.mask), seed, moved: false, practice: !!options.practice, history: [], result: null, playback: null, movement: null };
  }
  addPlayer(id: string, name: string, bot = false) {
    if (this.state.players.length >= 2 || this.state.phase !== 'waiting') throw Error('Room is full or already started');
    const slot = this.state.players.length, mode = MODES[this.state.mode];
    const p: Player = { id, name: name.trim().slice(0, 24) || `Player ${slot + 1}`, slot, connected: true, ready: bot, bot, score: 0, moves: mode.moves, shots: 0, ammo: { ...mode.ammo }, aim: { angle: slot ? 135 : 45, power: 60, weapon: 'standard' } };
    this.state.players.push(p); this.publish(); return p;
  }
  publish() { this.options.publish('state', structuredClone(this.state)); }
  connect(slot: number) { const p = this.state.players[slot]; p.connected = true; this.absent.delete(slot); this.publish(); }
  disconnect(slot: number, explicit = false) { if (this.state.result) return; this.state.players[slot].connected = false; this.absent.set(slot, this.now() + (explicit ? 0 : this.options.graceMs ?? 20000)); this.publish(); this.tick(); }
  command(slot: number, c: Command): Ack {
    const ack: Ack = { id: typeof c?.id === 'string' ? c.id.slice(0, 80) : '', ok: false, serverTime: this.now() };
    if (!c || c.v !== VERSION.protocol || !/^[a-zA-Z0-9:_-]{1,80}$/.test(c.id)) return { ...ack, error: 'Invalid command/protocol' };
    const key = `${slot}:${c.id}`, fingerprint = JSON.stringify(c), old = this.cache.get(key);
    if (old) return old.fingerprint === fingerprint ? old.ack : { ...ack, error: 'Command ID reused with different payload' };
    try {
      if (c.matchId !== this.state.matchId || c.turnId !== this.state.turnId) throw Error('Stale match or turn');
      const p = this.state.players[slot]; if (!p || !p.connected) throw Error('Seat unavailable');
      if (c.type === 'leave') this.disconnect(slot, true);
      else if (c.type === 'ready') {
        if (this.state.phase !== 'waiting' || typeof c.data !== 'boolean') throw Error('Cannot change readiness');
        p.ready = c.data;
        if (this.state.players.length === 2 && this.state.players.every(p => p.ready && p.connected)) { this.state.phase = 'countdown'; this.state.deadline = this.now() + (this.options.countdownMs ?? 3000); }
      } else if (c.type === 'rematch') {
        if (this.state.phase !== 'finished' || !this.state.players.every(p => p.connected)) throw Error('Both players must be connected at results');
        this.rematch.add(slot); if (this.state.practice) this.state.players.filter(p => p.bot).forEach(p => this.rematch.add(p.slot));
        if (this.rematch.size === 2) this.reset();
      } else {
        if (this.state.phase !== 'aiming' || slot !== this.state.active) throw Error('Not your aiming turn');
        if (this.now() >= this.state.deadline) { this.fire(this.state.players[this.state.active].aim); throw Error('Deadline passed; timeout fired'); }
        if (c.type === 'aim' || c.type === 'fire') {
          if (!validAim(c.data) || p.ammo[c.data.weapon] <= 0) throw Error('Invalid aim or unavailable weapon');
          if (c.type === 'aim') {
            const seq = (c.data as Aim & { seq: number }).seq;
            if (!Number.isInteger(seq) || seq <= (this.aimSeq.get(slot) ?? -1)) throw Error('Stale aim revision');
            this.aimSeq.set(slot, seq); p.aim = { angle: c.data.angle, power: c.data.power, weapon: c.data.weapon };
          } else this.fire(c.data);
        } else if (c.type === 'move') {
          if ((c.data !== 'left' && c.data !== 'right') || p.moves <= 0 || this.state.moved) throw Error('Move unavailable');
          const path = moveTank(this.mask, this.state.tanks[slot], c.data);
          if (path.length < 2) throw Error('Terrain blocks movement');
          p.moves--; this.state.moved = true; this.state.phase = 'moving'; this.state.movement = { slot, path, start: this.now(), duration: 350 };
        } else throw Error('Unknown command');
      }
      ack.ok = true; this.publish();
    } catch (e) { ack.error = (e as Error).message; }
    this.cache.set(key, { fingerprint, ack }); if (this.cache.size > 256) this.cache.delete(this.cache.keys().next().value!);
    return ack;
  }
  private reset() {
    const s = this.state, players = [...s.players].reverse(), mode = MODES[s.mode];
    // Swapping slots keeps the previous second player first, while swapping physical sides.
    s.players = players.map((p, slot) => ({ ...p, slot, score: 0, shots: 0, moves: mode.moves, ready: true, ammo: { ...mode.ammo }, aim: { angle: slot ? 135 : 45, power: 60, weapon: 'standard' } }));
    s.matchId = randomUUID(); s.turnId = 0; s.round = 0; s.seed = randomInt(0x7fffffff); s.phase = 'countdown'; s.deadline = this.now() + (this.options.countdownMs ?? 3000); s.result = null; s.history = []; s.playback = null; s.movement = null; s.terrainVersion = 0;
    this.mask = generateTerrain(s.seed); s.checksum = checksum(this.mask); s.tanks = [settle(this.mask, { x: 140, y: 250, slot: 0 }), settle(this.mask, { x: 884, y: 250, slot: 1 })];
    this.timeline = null; this.result = null; this.rematch.clear(); this.aimSeq.clear(); this.cache.clear(); this.options.publish('reset', null);
  }
  private nextTurn() {
    const s = this.state, count = s.players.reduce((n, p) => n + p.shots, 0);
    if (count >= MODES[s.mode].shots * 2) { this.finish(s.players[0].score === s.players[1].score ? null : s.players[0].score > s.players[1].score ? 0 : 1, 'All shots completed'); return; }
    s.turnId++; s.round = Math.floor(count / 2) + 1; s.active = count % 2 === 0 ? s.first : 1 - s.first;
    if (count % 2 === 0) s.wind = randomInt(-25, 26);
    s.phase = 'aiming'; s.deadline = this.now() + (this.options.turnMs ?? MODES[s.mode].seconds * 1000); s.moved = false; s.playback = null; s.movement = null;
    const p = s.players[s.active]; if (p.ammo[p.aim.weapon] === 0) p.aim.weapon = (Object.keys(p.ammo) as Weapon[]).find(w => p.ammo[w] > 0)!;
    this.aimSeq.clear(); this.botAt = this.now() + 900; this.publish();
  }
  private fire(aim: Aim) {
    const s = this.state; if (s.phase !== 'aiming') return;
    const p = s.players[s.active]; p.aim = { ...aim }; p.ammo[aim.weapon]--; p.shots++; s.phase = 'calculating'; this.publish();
    const match = s.matchId, turn = s.turnId, shooter = s.active;
    this.options.simulate({ mask: this.mask.slice(), tanks: structuredClone(s.tanks), shooter, aim: { ...aim }, wind: s.wind, version: s.terrainVersion }).then(result => {
      if (s.result || s.matchId !== match || s.turnId !== turn || s.phase !== 'calculating') return;
      const scale = this.options.playbackScale ?? 1;
      this.result = result;
      this.timeline = { id: `${match}:${turn}`, matchId: match, turnId: turn, start: this.now() + 150 * scale, duration: result.duration * scale, baseVersion: s.terrainVersion, tracks: result.tracks.map(t => ({ ...t, samples: t.samples.map(p => ({ ...p, t: p.t * scale })) })), events: result.events.map(e => ({ ...e, t: e.t * scale })), tanks: result.tanks, patch: result.patch, opponent: result.opponent, self: result.self, net: result.net };
      s.phase = 'playback'; s.playback = { id: this.timeline.id, start: this.timeline.start, duration: this.timeline.duration };
      this.options.publish('timeline', this.timeline); this.publish();
    }).catch((e: Error) => { if (s.matchId === match && s.turnId === turn && !s.result) { this.options.publish('server-error', { error: e.message }); this.abort('Shot calculation failed'); } });
  }
  tick() {
    const s = this.state, now = this.now(); if (s.result) return;
    const unavailable = s.players.filter(p => !p.connected), expired = unavailable.filter(p => (this.absent.get(p.slot) ?? Infinity) <= now);
    const terminal = expired.length && (unavailable.length === 1 || expired.length === 2);
    if (terminal && !['calculating', 'playback', 'moving'].includes(s.phase)) { if (s.players.length < 2) this.abort('Room left before match'); else if (unavailable.length === 2) this.abort('Both players disconnected'); else this.finish(1 - unavailable[0].slot, 'Opponent left or reconnect grace expired'); return; }
    if (s.phase === 'countdown' && now >= s.deadline) this.nextTurn();
    if (s.phase === 'moving' && s.movement && now >= s.movement.start + s.movement.duration) { const m = s.movement; Object.assign(s.tanks[m.slot], m.path.at(-1)); s.movement = null; s.phase = 'aiming'; this.publish(); this.tick(); return; }
    if (s.phase === 'aiming') {
      const p = s.players[s.active];
      if (now >= s.deadline) this.fire(p.aim);
      else if (p.bot && now >= this.botAt) {
        const distance = Math.abs(s.tanks[0].x - s.tanks[1].x), power = Math.round((Math.sqrt(distance * 180) - 100) / 4);
        this.fire({ ...p.aim, angle: p.slot ? 135 : 45, power: Math.max(1, Math.min(100, power + randomInt(-8, 9))) });
      }
    }
    if (s.phase === 'playback' && this.timeline && this.result && now >= this.timeline.start + this.timeline.duration) {
      const r = this.result; this.result = null; this.mask = r.mask; s.tanks = r.tanks; s.terrainVersion = r.patch.newVersion; s.checksum = r.patch.checksum; s.players[s.active].score += r.net;
      s.history.push({ id: this.timeline.id, round: s.round, player: s.active, weapon: s.players[s.active].aim.weapon, opponent: r.opponent, self: r.self, net: r.net }); s.history = s.history.slice(-20);
      this.options.publish('patch', r.patch); this.timeline = null; s.playback = null; s.phase = 'aiming';
      if (terminal) { if (unavailable.length === 2) this.abort('Both players disconnected'); else this.finish(1 - unavailable[0].slot, 'Opponent left or reconnect grace expired'); } else this.nextTurn();
    }
  }
  finish(winner: number | null, reason: string) { if (this.state.result) return; this.state.result = { winner, reason }; this.state.phase = 'finished'; this.state.playback = null; this.publish(); }
  abort(reason: string) { if (this.state.result) return; this.state.result = { winner: null, reason }; this.state.phase = 'aborted'; this.timeline = null; this.result = null; this.state.playback = null; this.publish(); }
}
