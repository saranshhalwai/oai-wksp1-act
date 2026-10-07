import { WORLD, hull, random, type Point, type Tank, type TerrainPatch } from '../../protocol/src/index';
const W = WORLD.width, H = WORLD.height;
export function solid(mask: Uint8Array, x: number, y: number): boolean { x = Math.floor(x); y = Math.floor(y); return x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1; }
export function generateTerrain(seed: number): Uint8Array {
  const rng = random(seed), a = rng() * 6, b = rng() * 6, mask = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const q = Math.min(x, W - 1 - x);
    const raw = Math.round(367 + 28 * Math.sin(q / 86 + a) + 19 * Math.sin(q / 43 + b));
    const blend = Math.min(1, Math.max(0, (Math.abs(q - 139.5) - 28) / 35));
    const top = Math.round(370 * (1 - blend) + raw * blend);
    for (let y = top; y < H; y++) mask[y * W + x] = 1;
  }
  return mask;
}
export function checksum(mask: Uint8Array): string { let h = 2166136261; for (let i = 0; i < mask.length; i++) h = Math.imul(h ^ mask[i], 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
export function pack(mask: Uint8Array): Uint8Array { const out = new Uint8Array(W * H / 8); for (let i = 0; i < mask.length; i++) if (mask[i]) out[i >> 3] |= 1 << (i & 7); return out; }
export function unpack(bytes: Uint8Array): Uint8Array { if (bytes.length !== W * H / 8) throw Error('Invalid terrain snapshot length'); const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = bytes[i >> 3] >> (i & 7) & 1; return m; }
export function subtractCircle(mask: Uint8Array, x: number, y: number, radius: number) {
  for (let py = Math.max(0, Math.floor(y - radius)); py <= Math.min(WORLD.bedrock - 1, Math.ceil(y + radius)); py++) {
    for (let px = Math.max(0, Math.floor(x - radius)); px <= Math.min(W - 1, Math.ceil(x + radius)); px++) {
      if ((px + .5 - x) ** 2 + (py + .5 - y) ** 2 <= radius ** 2) mask[py * W + px] = 0;
    }
  }
}
export function hullClear(mask: Uint8Array, t: Point): boolean {
  const h = hull(t);
  for (let y = Math.floor(h.top); y < Math.ceil(h.bottom); y++) for (let x = Math.floor(h.left); x < Math.ceil(h.right); x++) if (solid(mask, x, y)) return false;
  return true;
}
export function settle(mask: Uint8Array, tank: Tank): Tank {
  if (!hullClear(mask, tank)) throw Error('Hull intersects solid terrain');
  const t = { ...tank };
  for (let i = 0; i < H && t.y < WORLD.bedrock; i++) { if (!hullClear(mask, { ...t, y: t.y + 1 })) return t; t.y++; }
  if (hullClear(mask, { ...t, y: t.y + 1 })) throw Error('Missing support');
  return t;
}
export function moveTank(mask: Uint8Array, tank: Tank, direction: 'left' | 'right'): Point[] {
  let t = { ...tank }; const path: Point[] = [{ x: t.x, y: t.y }];
  for (let i = 0; i < 24; i++) {
    const x = t.x + (direction === 'left' ? -1 : 1);
    if (x < (tank.slot === 0 ? 32 : 544) || x > (tank.slot === 0 ? 480 : 992)) break;
    let next: Tank | undefined;
    for (let up = 0; up <= 6; up++) {
      const candidate = { ...t, x, y: t.y - up };
      if (!hullClear(mask, candidate) || !hullClear(mask, { ...t, y: candidate.y })) continue;
      const landed = settle(mask, candidate);
      if (landed.y - t.y <= 12 && t.y - landed.y <= 6) { next = landed; break; }
    }
    if (!next) break;
    t = next; path.push({ x: t.x, y: t.y });
  }
  return path;
}
export function diffTerrain(before: Uint8Array, after: Uint8Array, baseVersion: number): TerrainPatch {
  const spans: [number, number, number][] = []; let minX: number = W, minY: number = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (before[y * W + x] === after[y * W + x]) continue;
    const start = x; while (x + 1 < W && before[y * W + x + 1] !== after[y * W + x + 1]) x++;
    spans.push([y, start, x + 1]); minX = Math.min(minX, start); maxX = Math.max(maxX, x + 1); minY = Math.min(minY, y); maxY = Math.max(maxY, y + 1);
  }
  return { baseVersion, newVersion: baseVersion + 1, bounds: spans.length ? [minX, minY, maxX, maxY] : [0, 0, 0, 0], spans, checksum: checksum(after) };
}
export function applyPatch(mask: Uint8Array, version: number, p: TerrainPatch): Uint8Array {
  if (version !== p.baseVersion || p.newVersion !== version + 1 || p.spans.length > 10000 || p.bounds.length !== 4 || p.bounds.some(n => !Number.isInteger(n))) throw Error('Terrain version/bounds mismatch');
  const [x0, y0, x1, y1] = p.bounds;
  if (x0 < 0 || y0 < 0 || x1 > W || y1 > WORLD.bedrock || x1 < x0 || y1 < y0) throw Error('Invalid patch bounds');
  const out = mask.slice(); let last = -1;
  for (const [y, x, end] of p.spans) {
    if (![y, x, end].every(Number.isInteger) || y < y0 || y >= y1 || x < x0 || end > x1 || x >= end || y * W + x <= last) throw Error('Invalid terrain span');
    out.fill(0, y * W + x, y * W + end); last = y * W + end - 1;
  }
  if (checksum(out) !== p.checksum) throw Error('Terrain checksum mismatch');
  return out;
}
