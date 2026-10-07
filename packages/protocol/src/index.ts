export const VERSION = { protocol: 1, rules: 1, physics: 1 } as const;
export const WORLD = { width: 1024, height: 576, bedrock: 568, hullWidth: 28, hullHeight: 16, barrel: 20 } as const;
export const WEAPONS = {
  standard: { name: 'Standard Shell', description: 'One reliable round', radius: 36, score: 40, crater: 30, glyph: '●' },
  heavy: { name: 'Heavy Shell', description: 'A wider, deeper crater', radius: 54, score: 65, crater: 48, glyph: '◆' },
  scatter: { name: 'Scatter Volley', description: 'Three spreading shells', radius: 24, score: 18, crater: 20, glyph: '⋮' },
  cluster: { name: 'Airburst Cluster', description: 'Five fragments at the apex', radius: 22, score: 16, crater: 18, glyph: '✳' },
  borer: { name: 'Borer Shell', description: 'Drills a narrow corridor', radius: 34, score: 35, crater: 30, glyph: '↘' },
} as const;
export type Weapon = keyof typeof WEAPONS;
export type Mode = 'workshop-quick' | 'standard';
export const MODES = {
  'workshop-quick': { shots: 5, seconds: 20, moves: 3, ammo: { standard: 2, heavy: 1, scatter: 1, cluster: 1, borer: 0 } },
  standard: { shots: 10, seconds: 30, moves: 6, ammo: { standard: 3, heavy: 2, scatter: 2, cluster: 2, borer: 1 } },
} as const;
export type Phase = 'waiting' | 'countdown' | 'aiming' | 'moving' | 'calculating' | 'playback' | 'finished' | 'aborted';
export interface Point { x: number; y: number }
export interface Aim { angle: number; power: number; weapon: Weapon }
export interface Tank extends Point { slot: number }
export interface Player { id: string; name: string; slot: number; connected: boolean; ready: boolean; bot: boolean; score: number; moves: number; shots: number; ammo: Record<Weapon, number>; aim: Aim }
export interface History { id: string; round: number; player: number; weapon: Weapon; opponent: number; self: number; net: number }
export interface GameState {
  versions: typeof VERSION; build: string; roomCode: string; matchId: string; turnId: number; mode: Mode; phase: Phase;
  players: Player[]; tanks: Tank[]; active: number; first: number; round: number; wind: number; deadline: number;
  terrainVersion: number; checksum: string; seed: number; moved: boolean; practice: boolean; history: History[];
  result: null | { winner: number | null; reason: string }; playback: null | { id: string; start: number; duration: number };
  movement: null | { slot: number; start: number; duration: number; path: Point[] };
}
export interface Command { v: number; id: string; matchId: string; turnId: number; type: 'ready' | 'aim' | 'move' | 'fire' | 'rematch' | 'leave'; data?: unknown }
export interface Ack { id: string; ok: boolean; error?: string; serverTime: number }
export interface TerrainPatch { baseVersion: number; newVersion: number; bounds: [number, number, number, number]; spans: [number, number, number][]; checksum: string }
export interface Sample extends Point { t: number }
export interface Track { id: string; samples: Sample[] }
export interface ShotEvent extends Point { id: string; t: number; type: 'explosion' | 'split' | 'drill' | 'settle'; radius?: number; crater?: number; opponent?: number; self?: number; slot?: number; fromY?: number }
export interface Timeline { id: string; matchId: string; turnId: number; start: number; duration: number; baseVersion: number; tracks: Track[]; events: ShotEvent[]; tanks: Tank[]; patch: TerrainPatch; opponent: number; self: number; net: number }
export function hull(t: Point) { return { left: t.x - 14, right: t.x + 14, top: t.y - 16, bottom: t.y }; }
export function pivot(t: Point): Point { return { x: t.x, y: t.y - 15 }; }
export function muzzle(t: Point, angle: number): Point { const p = pivot(t), a = angle * Math.PI / 180; return { x: p.x + 20 * Math.cos(a), y: p.y - 20 * Math.sin(a) }; }
export function directionGuide(t: Point, angle: number): Point { const p = pivot(t), a = angle * Math.PI / 180; return { x: p.x + 55 * Math.cos(a), y: p.y - 55 * Math.sin(a) }; }
export function validAim(a: unknown): a is Aim { const v = a as Aim; return !!v && Number.isInteger(v.angle) && v.angle >= 0 && v.angle <= 180 && Number.isInteger(v.power) && v.power >= 1 && v.power <= 100 && Object.hasOwn(WEAPONS, v.weapon); }
export function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
export function random(seed: number) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
