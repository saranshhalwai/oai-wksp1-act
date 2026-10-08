import { Client, type Room } from '@colyseus/sdk';
import { VERSION, WEAPONS, MODES, WORLD, clamp, pivot, muzzle, hull, directionGuide, validAim, type GameState, type Timeline, type Command, type Ack, type Aim, type Mode, type Weapon, type ShotEvent, type Point, type TerrainPatch } from '../../protocol/src/index';
import { unpack, checksum, applyPatch, subtractCircle } from '../../terrain/src/index';
export { VERSION, WEAPONS, MODES, WORLD, pivot, muzzle, hull, directionGuide };
export type { GameState, Timeline, Aim, Mode, Weapon, ShotEvent, Point };
export interface TerrainView { readonly key: string; at(x: number, y: number): boolean; image(color: [number, number, number]): ImageData }
export interface RenderState { readonly state: Readonly<GameState> | null; readonly terrain: TerrainView | null; readonly tanks: readonly Point[]; readonly projectiles: readonly { id: string; x: number; y: number; trail: readonly Point[] }[]; readonly effects: readonly ShotEvent[]; readonly me: number; readonly draft: Readonly<Aim>; readonly connection: string; readonly pending: boolean; readonly error: string; readonly remaining: number; readonly canFire: boolean; readonly canMove: boolean; readonly playbackMs: number }
export interface FixtureRecording { state: GameState; terrain: Uint8Array; timeline: Timeline | null; label: string }
export interface ClientConfig { backendUrl: string; sessionKey?: string; fixture?: FixtureRecording }
const quantile = (a: number[], q: number) => a.length ? [...a].sort((a, b) => a - b)[Math.min(a.length - 1, Math.floor(a.length * q))] : 0;
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const v of Object.values(value)) freeze(v); } return value; }
export function screenToWorld(x: number, y: number, bounds: { left: number; top: number; width: number; height: number }): Point { const scale = Math.min(bounds.width / WORLD.width, bounds.height / WORLD.height); return { x: (x - bounds.left - (bounds.width - WORLD.width * scale) / 2) / scale, y: (y - bounds.top - (bounds.height - WORLD.height * scale) / 2) / scale }; }
export function angleFromPointer(tank: Point, point: Point) { const p = pivot(tank); return Math.round(clamp(Math.atan2(p.y - point.y, point.x - p.x) * 180 / Math.PI, 0, 180)); }
export function createArtilleryClient(config: ClientConfig) {
  const transport = new Client(config.backendUrl), listeners = new Set<() => void>(), events = new Set<(e: ShotEvent) => void>();
  const key = config.sessionKey ?? 'artillery-session';
  let room: Room | null = null, state: GameState | null = null, mask: Uint8Array | null = null, visual: Uint8Array | null = null, version = -1, timeline: Timeline | null = null;
  let connection = 'offline', error = '', destroyed = false, draft: Aim = { angle: 45, power: 60, weapon: 'standard' }, turnKey = '', me = -1, pendingFire = false;
  let offset = 0, clockReady = false, uncertainty = 0, resyncs = 0, ackToAnimation = 0, lastAck = 0, skew = 0, eventCursor = 0, visualRevision = 0, seq = 0;
  let aimTimer: ReturnType<typeof setTimeout> | undefined, lastResync = -Infinity;
  let frames = 0, fps = 0, fpsAt = performance.now();
  const rtts: number[] = [], acks: number[] = [], pending = new Map<string, { command: Command; resolve: (ack: Ack) => void; reject: (error: Error) => void; at: number; retries: number; timer: ReturnType<typeof setTimeout> }>();
  const notify = () => listeners.forEach(fn => fn());
  const save = () => { try { if (room) sessionStorage.setItem(key, room.reconnectionToken); } catch { /* Non-browser / storage disabled. */ } };
  const clearSaved = () => { try { sessionStorage.removeItem(key); } catch { /* Optional storage. */ } };
  const clearPending = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('Connection changed; command discarded')); } pending.clear(); pendingFire = false; clearTimeout(aimTimer); };
  function acceptState(next: GameState) {
    if (next.versions.protocol !== VERSION.protocol) { error = 'Protocol mismatch. Update your client.'; notify(); return; }
    state = freeze(next); me = room ? state.players.findIndex(p => p.id === room!.sessionId) : -1;
    const k = `${state.matchId}:${state.turnId}:${me}`;
    if (k !== turnKey) { turnKey = k; if (me >= 0) draft = { ...state.players[me].aim }; seq = 0; pendingFire = false; }
    if (timeline && (!state.playback || state.playback.id !== timeline.id)) { timeline = null; visual = mask?.slice() ?? null; eventCursor = 0; visualRevision++; }
    if (version >= 0 && state.terrainVersion !== version) requestResync();
    notify();
  }
  function setTimeline(t: Timeline | null) { if (!t) { timeline = null; return; } if (t.baseVersion !== version || t.events.length > 512 || t.tracks.length > 8 || t.tracks.some(p => p.samples.length > 400)) { requestResync(); return; } timeline = freeze(t); visual = mask!.slice(); eventCursor = 0; visualRevision++; skew = Math.max(0, performance.now() + offset - t.start); }
  function requestResync() { if (!room || performance.now() - lastResync < 400) return; lastResync = performance.now(); resyncs++; connection = 'synchronizing'; room.send('resync'); notify(); }
  function attach(r: Room) {
    room = r; connection = 'connected'; save();
    r.reconnection.maxRetries = 12; r.reconnection.maxEnqueuedMessages = 0;
    r.onStateChange((schema: { snapshot?: string }) => { if (schema.snapshot) acceptState(JSON.parse(schema.snapshot)); });
    r.onMessage('snapshot', (s: { state: GameState; terrain: Uint8Array; timeline: Timeline | null; serverTime: number }) => {
      try { const next = unpack(new Uint8Array(s.terrain)); if (checksum(next) !== s.state.checksum) throw Error('Corrupt snapshot'); mask = next; visual = next.slice(); version = s.state.terrainVersion; visualRevision++;
        if (!clockReady) { offset = s.serverTime - performance.now(); clockReady = true; }
        acceptState(s.state); setTimeline(s.timeline); connection = 'connected'; error = ''; save(); notify();
      } catch (e) { error = (e as Error).message; requestResync(); }
    });
    r.onMessage('timeline', (t: Timeline) => { setTimeline(t); notify(); });
    r.onMessage('patch', (p: TerrainPatch) => { try { if (!mask) throw Error('Missing terrain base'); mask = applyPatch(mask, version, p); visual = mask.slice(); version = p.newVersion; visualRevision++; } catch { requestResync(); } });
    r.onMessage('ack', (ack: Ack) => { const p = pending.get(ack.id); if (!p) return; clearTimeout(p.timer); pending.delete(ack.id); acks.push(performance.now() - p.at); if (acks.length > 120) acks.shift(); if (p.command.type === 'fire') { pendingFire = false; lastAck = performance.now(); } if (!ack.ok) error = ack.error ?? 'Command rejected'; p.resolve(ack); notify(); });
    r.onMessage('pong', (p: { echo: number; serverTime: number }) => { const now = performance.now(), rtt = now - p.echo; if (rtt < 0 || rtt > 10000) return; rtts.push(rtt); if (rtts.length > 120) rtts.shift(); const target = p.serverTime - (p.echo + now) / 2; offset = clockReady ? offset + clamp((target - offset) * .2, -5, 5) : target; clockReady = true; uncertainty = rtt / 2; });
    r.onMessage('server-error', () => { error = 'Server could not calculate the shot. Match aborted.'; notify(); });
    r.onDrop(() => { connection = 'reconnecting'; clearPending(); notify(); });
    r.onReconnect(() => { save(); clearPending(); requestResync(); });
    r.onLeave(() => { if (destroyed) return; connection = 'offline'; error = 'Connection closed. Create a new room if reconnect grace expired.'; clearPending(); clearSaved(); notify(); });
    r.onError((_code, message) => { error = message ?? 'Connection error'; notify(); });
    r.send('resync'); r.send('ping', performance.now()); notify();
  }
  function command(type: Command['type'], data?: unknown): Promise<Ack> {
    if (!room || !state || connection !== 'connected') return Promise.reject(Error('Not connected'));
    const c: Command = { v: VERSION.protocol, id: crypto.randomUUID(), matchId: state.matchId, turnId: state.turnId, type, data };
    return new Promise((resolve, reject) => {
      const resend = () => { const p = pending.get(c.id); if (!p) return; if (++p.retries > 2 || !room || c.turnId !== state?.turnId || connection !== 'connected') { pending.delete(c.id); pendingFire = false; error = 'Acknowledgment timed out; synchronizing'; reject(Error(error)); requestResync(); return; } room.send('command', c); p.timer = setTimeout(resend, 1500); };
      pending.set(c.id, { command: c, resolve, reject, at: performance.now(), retries: 0, timer: setTimeout(resend, 1500) }); room!.send('command', c);
    });
  }
  async function join(action: () => Promise<Room>) { connection = 'connecting'; error = ''; notify(); try { attach(await action()); } catch (e) { connection = 'offline'; error = (e as Error).message; notify(); throw e; } }
  const heartbeat = setInterval(() => { if (room && connection === 'connected') room.send('ping', performance.now()); }, 1500);
  const onVisible = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible' && room) requestResync(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
  function setAim(a: Partial<Aim>) { const next = { ...draft, ...a }; if (!validAim(next)) return; draft = next; notify(); if (aimTimer) return; aimTimer = setTimeout(() => { aimTimer = undefined; if (state?.phase === 'aiming' && state.active === me && !pendingFire) void command('aim', { ...draft, seq: ++seq }).catch(() => {}); }, 100); }
  function getRenderState(): RenderState {
    const now = performance.now() + offset, t = timeline ? Math.max(0, now - timeline.start) : 0;
    const tanks = state?.tanks.map(p => ({ x: p.x, y: p.y })) ?? [], effects: ShotEvent[] = [], projectiles: { id: string; x: number; y: number; trail: Point[] }[] = [];
    if (timeline && visual && now >= timeline.start) {
      if (lastAck) { ackToAnimation = performance.now() - lastAck; lastAck = 0; }
      while (eventCursor < timeline.events.length && timeline.events[eventCursor].t <= t) {
        const e = timeline.events[eventCursor++]; if (e.crater) { subtractCircle(visual, e.x, e.y, e.crater); visualRevision++; }
        if (t - e.t < 100) events.forEach(fn => fn(e));
      }
      for (const e of timeline.events) {
        if (e.t > t) continue; if (t - e.t < 650) effects.push(e);
        if (e.type === 'settle' && e.slot !== undefined && e.fromY !== undefined) tanks[e.slot].y = e.fromY + (e.y - e.fromY) * clamp((t - e.t) / 350, 0, 1);
      }
      for (const track of timeline.tracks) {
        if (t < track.samples[0].t || t > track.samples.at(-1)!.t) continue;
        const i = track.samples.findIndex(p => p.t >= t), b = track.samples[Math.max(0, i)], a = track.samples[Math.max(0, i - 1)], u = b.t === a.t ? 1 : clamp((t - a.t) / (b.t - a.t), 0, 1);
        projectiles.push({ id: track.id, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, trail: track.samples.slice(Math.max(0, i - 9), i) });
      }
    }
    if (state?.movement) { const m = state.movement, progress = clamp((now - m.start) / m.duration, 0, 1) * (m.path.length - 1), a = m.path[Math.floor(progress)], b = m.path[Math.ceil(progress)]; tanks[m.slot] = { x: a.x + (b.x - a.x) * (progress % 1), y: a.y + (b.y - a.y) * (progress % 1) }; }
    const currentMask = visual; const terrain: TerrainView | null = currentMask ? { key: `${version}:${visualRevision}`, at: (x, y) => currentMask[Math.floor(y) * 1024 + Math.floor(x)] === 1, image: color => { const data = new Uint8ClampedArray(1024 * 576 * 4); for (let i = 0; i < currentMask.length; i++) if (currentMask[i]) { data[i * 4] = color[0]; data[i * 4 + 1] = color[1]; data[i * 4 + 2] = color[2]; data[i * 4 + 3] = 255; } return new ImageData(data, 1024, 576); } } : null;
    frames++; if (performance.now() - fpsAt > 1000) { fps = frames * 1000 / (performance.now() - fpsAt); frames = 0; fpsAt = performance.now(); }
    const canFire = !!state && connection === 'connected' && state.phase === 'aiming' && state.active === me && !pendingFire && now < state.deadline;
    return { state, terrain, tanks, projectiles, effects, me, draft: { ...draft }, connection, pending: pendingFire, error, remaining: state ? Math.max(0, (state.deadline - now) / 1000) : 0, canFire, canMove: canFire && !state!.moved && state!.players[me].moves > 0, playbackMs: t };
  }
  if (config.fixture) {
    mask = unpack(config.fixture.terrain); visual = mask.slice(); version = config.fixture.state.terrainVersion;
    state = freeze(structuredClone(config.fixture.state)); me = 0; draft = { ...state.players[0].aim }; connection = 'fixture'; clockReady = true;
    setTimeline(config.fixture.timeline ? { ...config.fixture.timeline, start: performance.now() + 500 } : null);
  }
  return {
    createRoom: (options: { displayName: string; mode: Mode }) => join(() => transport.create('battle', options)),
    joinRoom: (options: { roomCode: string; displayName: string }) => join(async () => {
      try { return await transport.joinById(options.roomCode.trim().toUpperCase(), { displayName: options.displayName }); }
      catch (e) {
        if ((e as { code?: number }).code === 522) throw Error('Room unavailable: it may have been disbanded, expired, or the code is incorrect. Create or join a new room.');
        throw e;
      }
    }),
    startPractice: (options: { displayName: string; mode: Mode }) => join(() => transport.create('battle', { ...options, practice: true })),
    async restoreSession() { if (config.fixture) return; let token: string | null = null; try { token = sessionStorage.getItem(key); } catch { return; } if (token) { try { await join(() => transport.reconnect(token!)); } catch { clearSaved(); } } },
    setReady: (ready: boolean) => command('ready', ready), setAim, selectWeapon: (weapon: Weapon) => setAim({ weapon }),
    move: (direction: 'left' | 'right') => command('move', direction),
    fire() { if (!getRenderState().canFire) return Promise.reject(Error('Fire unavailable')); pendingFire = true; clearTimeout(aimTimer); aimTimer = undefined; error = ''; notify(); return command('fire', { ...draft }); },
    getRenderState, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, subscribeEvents(fn: (event: ShotEvent) => void) { events.add(fn); return () => { events.delete(fn); }; },
    getConnectionStats() { return { rttP50: quantile(rtts, .5), rttP95: quantile(rtts, .95), jitter: quantile(rtts, .95) - quantile(rtts, .5), ackP50: quantile(acks, .5), ackP95: quantile(acks, .95), ackToAnimation, clockUncertainty: uncertainty, playbackSkew: skew, resyncs, fps }; },
    requestResync, requestRematch: () => command('rematch'),
    async leave() {
      const previous = room;
      clearSaved(); clearPending();
      // Release the UI immediately. A deliberate transport leave invokes the
      // server's explicit-leave policy even if a command ack is unavailable.
      room = null; state = null; mask = visual = null; timeline = null;
      version = -1; turnKey = ''; me = -1; clockReady = false;
      connection = 'offline'; error = ''; notify();
      if (previous) {
        previous.reconnection.enabled = false;
        previous.removeAllListeners();
        try { if (previous.connection?.isOpen) await previous.leave(); else previous.connection?.close(); }
        finally { previous.serializer?.teardown(); }
      }
    },
    destroy() { if (destroyed) return; destroyed = true; clearInterval(heartbeat); clearTimeout(aimTimer); clearPending(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); listeners.clear(); events.clear(); if (room) { room.removeAllListeners(); void room.leave(false); } },
  };
}
export type ArtilleryClient = ReturnType<typeof createArtilleryClient>;
