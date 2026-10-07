import { pair, shotPair } from './load-test/clients';
const url = process.env.BACKEND_URL ?? 'http://localhost:2567';
const [a,b] = await pair(url);
try { await shotPair(a,b,0); console.log(JSON.stringify({ ok: true, url, room: a.state.roomCode, checksum: a.state.checksum, version: a.state.terrainVersion })); }
finally { await a.close(); await b.close(); }
