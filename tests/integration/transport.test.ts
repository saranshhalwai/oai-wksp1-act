import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client } from '@colyseus/sdk';
import { Headless, pair, shotPair, until } from '../../tools/load-test/clients';
let processHandle: ChildProcess;
const url = 'http://127.0.0.1:2599';
beforeAll(async () => { processHandle = spawn(process.execPath, ['dist/server/index.js'], { env: { ...process.env, PORT: '2599', HOST: '127.0.0.1', ALLOWED_ORIGINS: 'http://localhost:5175,https://*.chatgpt.site' }, stdio: 'ignore' }); const end = Date.now()+15000; while (Date.now()<end) { try { if ((await fetch(`${url}/readyz`)).ok) return; } catch { /* process starting */ } await new Promise(r=>setTimeout(r,50)); } throw Error('Test backend failed to start; run node tools/build.mjs --server-only first'); },20000);
afterAll(async () => { processHandle?.kill('SIGTERM'); await new Promise<void>(r=>{ if(!processHandle || processHandle.exitCode!==null)return r(); processHandle.once('exit',()=>r()); }); },40000);
describe('real Colyseus transport', () => {
  it('accepts Sites preflight and rejects lookalike domains at matchmaking admission', async () => {
    const origin = 'https://workshop.chatgpt.site';
    const preflight = await fetch(`${url}/readyz`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    const rejected = await fetch(`${url}/matchmake/create/battle`, { method: 'POST', headers: { Origin: 'https://workshop.chatgpt.site.evil.example' } });
    expect(rejected.status).toBe(403);
  });
  it('rejects unapproved HTTP origins', async () => { const r = await fetch(`${url}/matchmake/create/battle`, { method:'POST',headers:{Origin:'https://unapproved.invalid','Content-Type':'application/json'},body:JSON.stringify({displayName:'Intruder'}) }); expect(r.status).toBe(403); });
  it('creates, joins, rejects a third seat, acknowledges idempotently and commits a real worker shot', async () => { const [a,b]=await pair(url); try { await expect(new Client(url).joinById(a.state.roomCode,{displayName:'Third'})).rejects.toThrow(); await until(()=>a.state.phase==='aiming'&&b.state.phase==='aiming'); const shooter=a.slot===a.state.active?a:b; const aim={...shooter.state.players[shooter.slot].aim}; const overrides={id:'duplicate-packet'}; const first=await shooter.command('aim',{...aim,seq:1},overrides); expect(await shooter.command('aim',{...aim,seq:1},overrides)).toEqual(first); expect((await shooter.command('aim',{...aim,seq:2},overrides)).ok).toBe(false); await shotPair(a,b,2); expect(a.state.checksum).toBe(b.state.checksum); expect(a.state.players.reduce((n,p)=>n+p.shots,0)).toBe(1); } finally { await a.close();await b.close(); } });
  it('recovers a real reconnect token and never exposes another seat', async () => { const transport=new Client(url), a=new Headless(await transport.create('battle',{displayName:'Reconnect'})); await until(()=>!!a.state); const token=a.room.reconnectionToken; const id=a.room.sessionId; a.room.reconnection.enabled=false; await a.room.leave(false); const recovered=new Headless(await transport.reconnect(token)); try { await until(()=>!!recovered.state); expect(recovered.room.sessionId).toBe(id); expect(recovered.state.players[0].connected).toBe(true); expect(recovered.state.checksum).toBe(a.state.checksum); }finally{await recovered.close();} });
});
