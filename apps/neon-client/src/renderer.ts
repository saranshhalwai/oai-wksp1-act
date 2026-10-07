import { pivot, muzzle, directionGuide, type RenderState } from '../../../packages/client-sdk/src/index';
export function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!, layer = document.createElement('canvas'); layer.width = 1024; layer.height = 576; const terrain = layer.getContext('2d')!; let terrainKey = '';
  function polygon(points: number[][], fill: string, stroke?: string) { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
  return { draw(v: RenderState, reduced: boolean) {
    const sky = ctx.createLinearGradient(0, 0, 0, 576); sky.addColorStop(0, '#081522'); sky.addColorStop(1, '#132c39'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = '#90bcc4'; for (let i = 0; i < 65; i++) { const x = (i * 167 + 31) % 1024, y = (i * 53 + 17) % 310; ctx.globalAlpha = .15 + i % 4 * .1; ctx.fillRect(x, y, 1, 1); } ctx.globalAlpha = 1;
    ctx.strokeStyle = '#25434b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(796, 122, 46, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#153940'; ctx.beginPath(); ctx.arc(796, 122, 39, 0, Math.PI * 2); ctx.fill();
    polygon([[0, 345], [90, 263], [140, 292], [283, 196], [415, 326], [542, 248], [671, 334], [815, 242], [1024, 346], [1024, 576], [0, 576]], '#122633');
    polygon([[0, 372], [157, 312], [290, 357], [417, 280], [564, 376], [722, 308], [906, 333], [1024, 290], [1024, 576], [0, 576]], '#19343f');
    if (v.terrain) {
      if (v.terrain.key !== terrainKey) { terrainKey = v.terrain.key; terrain.putImageData(v.terrain.image([23, 53, 57]), 0, 0); terrain.globalCompositeOperation = 'source-atop'; terrain.strokeStyle = '#244a4b'; terrain.lineWidth = 1; for (let y = 0; y < 576; y += 24) { terrain.beginPath(); terrain.moveTo(0, y); terrain.lineTo(1024, y); terrain.stroke(); } for (let x = 0; x < 1024; x += 32) { terrain.beginPath(); terrain.moveTo(x, 0); terrain.lineTo(x, 576); terrain.stroke(); } terrain.globalCompositeOperation = 'source-over'; terrain.fillStyle = '#60bdad'; for (let x = 0; x < 1024; x++) for (let y = 1; y < 568; y++) if (v.terrain.at(x, y) && !v.terrain.at(x, y - 1)) terrain.fillRect(x, y, 1, 1); }
      ctx.drawImage(layer, 0, 0);
    } else { polygon([[0, 384], [130, 370], [223, 376], [334, 416], [512, 437], [658, 392], [810, 367], [915, 370], [1024, 399], [1024, 576], [0, 576]], '#183b3f', '#4b9a8f'); ctx.strokeStyle = '#22504d'; for (let y = 448; y < 576; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); } }
    const tanks = v.tanks.length ? v.tanks : [{ x: 140, y: 370 }, { x: 884, y: 370 }];
    tanks.forEach((tank, i) => { const color = i === 0 ? '#64ebd9' : '#ffc979', angle = i === v.me ? v.draft.angle : v.state?.players[i]?.aim.angle ?? (i ? 135 : 45), p = pivot(tank), m = muzzle(tank, angle);
      ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      polygon([[tank.x - 14, tank.y - 9], [tank.x - 9, tank.y - 16], [tank.x + 7, tank.y - 16], [tank.x + 14, tank.y - 8], [tank.x + 12, tank.y - 1], [tank.x - 12, tank.y - 1]], '#203d48', color);
      ctx.fillStyle = '#06171e'; ctx.fillRect(tank.x - 11, tank.y - 6, 22, 5); ctx.fillStyle = color; for (let n = -8; n <= 8; n += 8) ctx.fillRect(tank.x + n - 1, tank.y - 4, 3, 2);
      ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillText(i === v.me ? '▲ YOU' : i ? '◆ 02' : '▲ 01', tank.x, tank.y + 22);
      if (v.canFire && i === v.me) { const g = directionGuide(tank, angle); ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]); }
    });
    for (const p of v.projectiles) { ctx.strokeStyle = '#b7fff0'; ctx.lineWidth = 2; ctx.beginPath(); p.trail.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.fillStyle = '#f3ffeb'; ctx.shadowColor = '#69ffe3'; ctx.shadowBlur = reduced ? 0 : 12; ctx.beginPath(); ctx.arc(p.x, Math.max(8, p.y), 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; if (p.y < 0) { ctx.font = '11px monospace'; ctx.fillText('↑', p.x, 22); } }
    for (const e of v.effects) { const age = v.playbackMs - e.t; if (e.type === 'explosion') { ctx.globalAlpha = Math.max(0, 1 - age / 650); ctx.strokeStyle = '#ffcf80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, reduced ? 12 : (e.radius ?? 30) * Math.min(1, age / 260), 0, Math.PI * 2); ctx.stroke(); if (!reduced) for (let i = 0; i < 12; i++) { const a = i * 2.399, r = age * .09; ctx.fillStyle = i % 2 ? '#60b7a6' : '#ffcc80'; ctx.fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r + age * age * .00006, 3, 3); } ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(`+${e.opponent} / −${e.self}`, e.x, e.y - 32 - age * .02); ctx.globalAlpha = 1; } else if (e.type === 'split' || e.type === 'drill') { ctx.fillStyle = '#fff1bd'; ctx.fillRect(e.x - 3, e.y - 3, 6, 6); } }
  } };
}
