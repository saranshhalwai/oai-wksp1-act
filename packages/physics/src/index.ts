import { WORLD, WEAPONS, clamp, hull, muzzle, type Aim, type Point, type Tank, type Track, type ShotEvent } from '../../protocol/src/index';
import { solid, subtractCircle, settle, diffTerrain } from '../../terrain/src/index';
export interface ShotInput { mask: Uint8Array; tanks: Tank[]; shooter: number; aim: Aim; wind: number; version: number }
export interface ShotResult { mask: Uint8Array; tanks: Tank[]; tracks: Track[]; events: ShotEvent[]; duration: number; patch: ReturnType<typeof diffTerrain>; opponent: number; self: number; net: number; steps: number }
interface Projectile extends Point { id: string; vx: number; vy: number; child: boolean; exited: boolean; live: boolean; track: Track }
export function distanceToHull(p: Point, tank: Point) { const h = hull(tank); return Math.hypot(Math.max(h.left - p.x, 0, p.x - h.right), Math.max(h.top - p.y, 0, p.y - h.bottom)); }
export function contribution(p: Point, t: Point, radius: number, max: number) { return Math.round(max * Math.max(0, 1 - distanceToHull(p, t) / radius)); }
function terrainContact(mask: Uint8Array, p: Point) {
  for (let y = Math.floor(p.y - 2); y <= Math.floor(p.y + 2); y++) for (let x = Math.floor(p.x - 2); x <= Math.floor(p.x + 2); x++) {
    if (solid(mask, x, y) && Math.hypot(Math.max(x - p.x, 0, p.x - x - 1), Math.max(y - p.y, 0, p.y - y - 1)) <= 2) return true;
  }
  return false;
}
// Tank slot wins ties, then solid mask. Sampling the swept circle every <=0.5 unit prevents thin-cell tunneling.
export function contact(mask: Uint8Array, tanks: Tank[], p: Point, ignore: number) {
  for (const t of tanks) if (t.slot !== ignore && distanceToHull(p, t) <= 2) return 'tank';
  return terrainContact(mask, p) ? 'terrain' : null;
}
const handlers = {
  standard: { offsets: [0], split: false, drill: false }, heavy: { offsets: [0], split: false, drill: false },
  scatter: { offsets: [-6, 0, 6], split: false, drill: false }, cluster: { offsets: [0], split: true, drill: false }, borer: { offsets: [0], split: false, drill: true },
};
export function simulateShot(input: ShotInput): ShotResult {
  const mask = input.mask.slice(), tanks = input.tanks.map(t => ({ ...t })), events: ShotEvent[] = [], tracks: Track[] = [], projectiles: Projectile[] = [];
  const handler = handlers[input.aim.weapon], definition = WEAPONS[input.aim.weapon];
  let opponent = 0, self = 0, last = 0, eventId = 0, steps = 0;
  const add = (p: Point, vx: number, vy: number, child: boolean, t: number) => {
    const id = `p${tracks.length}`, track = { id, samples: [{ ...p, t }] }; tracks.push(track);
    projectiles.push({ ...p, id, vx, vy, child, exited: distanceToHull(p, tanks[input.shooter]) > 3, live: true, track });
  };
  const emit = (e: Omit<ShotEvent, 'id'>) => { if (events.length >= 512) throw Error('Event limit'); events.push({ ...e, id: `e${eventId++}` }); last = Math.max(last, e.t); };
  const explode = (p: Point, t: number, child: boolean) => {
    const d = handler.split && !child ? { radius: 24, score: 20, crater: 20 } : definition;
    const o = contribution(p, tanks[1 - input.shooter], d.radius, d.score), s = contribution(p, tanks[input.shooter], d.radius, d.score);
    opponent += o; self += s; subtractCircle(mask, p.x, p.y, d.crater);
    emit({ ...p, t, type: 'explosion', radius: d.radius, crater: d.crater, opponent: o, self: s });
  };
  const speed = 100 + 4 * input.aim.power;
  for (const offset of handler.offsets) { const angle = clamp(input.aim.angle + offset, 0, 180), a = angle * Math.PI / 180; add(muzzle(tanks[input.shooter], angle), speed * Math.cos(a), -speed * Math.sin(a), false, 0); }
  const dt = 1 / 120;
  for (let step = 0; step < 1440 && projectiles.some(p => p.live); step++) {
    steps++; const t0 = step * dt * 1000;
    // Snapshot the live list so new cluster children start on the next fixed step.
    for (const p of projectiles.filter(p => p.live)) {
      const oldVy = p.vy, old = { x: p.x, y: p.y };
      p.vx += input.wind * dt; p.vy += 180 * dt;
      const next = { x: p.x + p.vx * dt, y: p.y + p.vy * dt };
      const n = Math.max(1, Math.ceil(Math.hypot(next.x - old.x, next.y - old.y) / .5));
      let hit: string | null = null, time = t0;
      for (let j = 0; j <= n; j++) {
        const u = j / n; p.x = old.x + (next.x - old.x) * u; p.y = old.y + (next.y - old.y) * u; time = t0 + u * dt * 1000;
        if (p.x < 0 || p.x >= WORLD.width || p.y < -2048 || p.y >= WORLD.height) { p.live = false; break; }
        if (distanceToHull(p, tanks[input.shooter]) > 3) p.exited = true;
        hit = contact(mask, tanks, p, p.exited ? -1 : input.shooter);
        if (hit) { p.live = false; break; }
        if (handler.split && !p.child && oldVy <= 0 && p.vy >= 0 && u >= -oldVy / (180 * dt)) {
          p.live = false; emit({ x: p.x, y: p.y, t: time, type: 'split' });
          for (const dv of [-90, -45, 0, 45, 90]) add({ x: p.x, y: p.y }, p.vx + dv, 40, true, (step + 1) * dt * 1000);
          break;
        }
      }
      if (hit && handler.drill && hit === 'terrain') {
        const len = Math.hypot(p.vx, p.vy), dx = p.vx / len, dy = p.vy / len;
        for (let k = 0; k <= 60; k++) {
          if (p.x < 2 || p.x >= 1022 || p.y + 6 >= WORLD.bedrock || tanks.some(t => distanceToHull(p, t) <= 2)) break;
          subtractCircle(mask, p.x, p.y, 6); emit({ x: p.x, y: p.y, t: time + k * 5, type: 'drill', crater: 6 });
          if (k < 60) { p.x += dx; p.y += dy; }
        }
        time = Math.max(time, last);
      }
      if (hit) explode(p, time, p.child);
      if (step % 4 === 0 || !p.live) p.track.samples.push({ x: p.x, y: p.y, t: time });
      last = Math.max(last, time);
    }
    if (projectiles.filter(p => p.live).length > 5) throw Error('Projectile limit');
  }
  for (const p of projectiles) if (p.live) p.track.samples.push({ x: p.x, y: p.y, t: 12000 });
  const settleStart = Math.min(12300, last + 180);
  for (let i = 0; i < tanks.length; i++) {
    const final = settle(mask, tanks[i]);
    if (final.y !== tanks[i].y) emit({ x: final.x, y: final.y, fromY: tanks[i].y, slot: final.slot, t: settleStart, type: 'settle' });
    tanks[i] = final;
  }
  events.sort((a, b) => a.t - b.t || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { mask, tanks, tracks, events, duration: Math.min(13000, Math.max(last + 450, settleStart + 400)), patch: diffTerrain(input.mask, mask, input.version), opponent, self, net: opponent - self, steps };
}
