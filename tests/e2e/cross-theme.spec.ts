import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const neon = process.env.NEON_URL ?? 'http://localhost:5173/neon/', paper = process.env.PAPER_URL ?? 'http://localhost:5174/paper/';
async function current(page: Page) { return page.evaluate(() => { const v = window.artillery!.getRenderState(); return { state: v.state, me: v.me, canFire: v.canFire, connection: v.connection }; }); }
test('Neon and Paper finish a shared quick match, refresh during flight, and rematch', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext(); const p = await a.newPage(), q = await b.newPage(); const errors: string[] = []; p.on('pageerror', e => errors.push(e.message)); q.on('pageerror', e => errors.push(e.message));
  await p.goto(neon); await q.goto(paper); await p.screenshot({ path: 'test-results/neon-lobby.png', fullPage: true }); await q.screenshot({ path: 'test-results/paper-lobby.png', fullPage: true });
  await p.getByLabel('Callsign').fill('Cyan Pilot'); await p.getByRole('button', { name: 'Create a room' }).click(); await expect(p.getByTestId('room-code')).toBeVisible(); const code = await p.getByTestId('room-code').innerText();
  await q.getByLabel('Callsign').fill('Paper Captain'); await q.getByLabel('Room code', { exact: true }).fill(code); await q.getByRole('button', { name: 'Join →' }).click();
  await expect(q.getByTestId('room-code')).toHaveText(code); await p.getByRole('button', { name: 'Ready up', exact: true }).click(); await q.getByRole('button', { name: 'Ready up', exact: true }).click();
  for (let shot = 0; shot < 10; shot++) {
    await expect.poll(async () => (await current(p)).state?.phase).toBe('aiming');
    await expect.poll(async () => (await current(q)).state?.phase).toBe('aiming');
    const v = await current(p), shooter = v.me === v.state!.active ? p : q;
    if (shot === 0) { await shooter.getByLabel('Angle', { exact: true }).fill(v.state!.active ? '120' : '60'); await shooter.getByLabel('Power', { exact: true }).fill('70'); await p.screenshot({ path: 'test-results/neon-aiming.png', fullPage: true }); await q.screenshot({ path: 'test-results/paper-aiming.png', fullPage: true }); }
    await shooter.evaluate(async () => { const c = window.artillery!, v = c.getRenderState(); c.setAim({ angle: v.me ? 120 : 60, power: 55 }); await c.fire(); });
    await expect.poll(async () => (await current(p)).state?.phase).toBe('playback');
    if (shot === 0) { await p.waitForTimeout(400); await p.screenshot({ path: 'test-results/neon-flight.png', fullPage: true }); await q.reload(); await expect.poll(async () => (await current(q)).connection).toBe('connected'); await q.screenshot({ path: 'test-results/paper-recovered.png', fullPage: true }); }
    await expect.poll(async () => (await current(p)).state?.history.length, { timeout: 20000 }).toBe(shot + 1);
    await expect.poll(async () => (await current(q)).state?.terrainVersion).toBe(shot + 1);
    const l = (await current(p)).state!, r = (await current(q)).state!; expect(l.checksum).toBe(r.checksum); expect(l.tanks).toEqual(r.tanks); expect(l.players).toEqual(r.players);
    if (shot === 3) { await p.screenshot({ path: 'test-results/neon-craters.png', fullPage: true }); await q.screenshot({ path: 'test-results/paper-craters.png', fullPage: true }); }
  }
  await expect.poll(async () => (await current(p)).state?.phase).toBe('finished'); await p.screenshot({ path: 'test-results/neon-results.png', fullPage: true }); await q.screenshot({ path: 'test-results/paper-results.png', fullPage: true });
  writeFileSync('test-results/browser-stats.json',JSON.stringify({neon:await p.evaluate(()=>window.artillery!.getConnectionStats()),paper:await q.evaluate(()=>window.artillery!.getConnectionStats()),userAgent:await p.evaluate(()=>navigator.userAgent),viewport:p.viewportSize()},null,2));
  const match = (await current(p)).state!.matchId; await p.getByRole('button', { name: 'Play again' }).click(); await q.getByRole('button', { name: 'Play again' }).click(); await expect.poll(async () => (await current(p)).state?.matchId).not.toBe(match);
  expect(errors).toEqual([]); await p.evaluate(() => window.artillery!.leave()); await a.close(); await b.close();
});
test('both layouts remain readable at target sizes', async ({ page }) => {
  for (const [name, url] of [['neon', neon], ['paper', paper]]) for (const size of [{ width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size); await page.goto(url); await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `test-results/${name}-${size.width}.png`, fullPage: true });
  }
});
test('standard weapons recover after a cluster split and during a drill', async ({ browser }) => {
  const a=await browser.newContext(),b=await browser.newContext(),p=await a.newPage(),q=await b.newPage();
  await p.goto(neon);await q.goto(paper);await p.getByLabel('Match length').selectOption('standard');await p.getByRole('button',{name:'Create a room'}).click();const code=await p.getByTestId('room-code').innerText();await q.getByLabel('Room code',{exact:true}).fill(code);await q.getByRole('button',{name:'Join →'}).click();await expect(q.getByTestId('room-code')).toHaveText(code);await p.getByRole('button',{name:'Ready up',exact:true}).click();await q.getByRole('button',{name:'Ready up',exact:true}).click();
  for(const [i,weapon]of ['cluster','borer'].entries()) {
    await expect.poll(async()=>(await current(p)).state?.phase).toBe('aiming');await expect.poll(async()=>(await current(q)).state?.phase).toBe('aiming');const v=await current(p),shooter=v.me===v.state!.active?p:q,observer=shooter===p?q:p;
    await shooter.evaluate(async w=>{const c=window.artillery!,v=c.getRenderState();c.selectWeapon(w as 'cluster'|'borer');c.setAim({angle:v.me?(w==='cluster'?120:155):(w==='cluster'?60:25),power:w==='cluster'?80:35});await c.fire();},weapon);
    await expect.poll(()=>observer.evaluate(w=>{const v=window.artillery!.getRenderState();return w==='cluster'?v.projectiles.length===5:v.effects.some(e=>e.type==='drill');},weapon),{intervals:[40],timeout:15000}).toBe(true);
    await observer.screenshot({path:`test-results/${weapon}-before-refresh.png`,fullPage:true});await observer.reload();await expect.poll(async()=>(await current(observer)).connection).toBe('connected');
    await expect.poll(async()=>(await current(p)).state?.terrainVersion,{timeout:20000}).toBe(i+1);await expect.poll(async()=>(await current(q)).state?.terrainVersion).toBe(i+1);expect((await current(p)).state!.checksum).toBe((await current(q)).state!.checksum);
  }
  await p.evaluate(()=>window.artillery!.leave());await a.close();await b.close();
});
