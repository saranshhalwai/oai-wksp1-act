# Internal host-demo client

This implementation supports the host's Neon and Paper demos and the retired internal starter prototype. It is not supplied to attendees or packaged for workshop distribution. Attendees implement their own clients using BACKEND_CONNECTION.md and PROTOCOL.md. The APIs below are internal implementation details, not the participant integration contract.

The internal package exports ordinary types and helpers; no server code or best-shot solver. `@colyseus/sdk` is a pinned transport dependency in the host repository. Instantiate once per UI lifecycle and call idempotent `destroy()` during teardown. Subscribe returns an unsubscribe function. Avoid constructing twice during React StrictMode; use an effect-owned instance or stable provider.

```ts
import { createArtilleryClient } from '@artillery/client-sdk';
const client = createArtilleryClient({
  backendUrl: 'https://YOUR_GAME_DOMAIN', // public configuration
  sessionKey: 'my-theme-session'
});
await client.restoreSession();
await client.createRoom({ displayName: 'Ada', mode: 'workshop-quick' });
// Other player: client.joinRoom({ roomCode: 'ABC234', displayName: 'Lin' })
await client.setReady(true);
client.setAim({ angle: 45, power: 60 });
client.selectWeapon('heavy');
await client.fire(); // captures final local aim; resolves authoritative Ack
```

`startPractice(options)` adds the server bot. `move('left'|'right')`, `requestRematch()` and `leave()` return acknowledgments/promises. Inspect `ack.ok`/`ack.error`; transport failures reject. `requestResync()` requests binary terrain, committed state and an active timeline. `subscribe` updates UI on meaningful changes; `subscribeEvents` emits timely effects only. RequestAnimationFrame calls `getRenderState()` for interpolation. It never advances game state.

Render fields: `state`, `me` (slot index), `draft`, `tanks`, `terrain`, `projectiles`, `effects`, `remaining`, `pending`, `connection`, `canFire`, `canMove`, `error`. Public state is deeply frozen. Terrain has no mutation API: `at(x,y)`, `image([r,g,b])`, and a cache `key`. Canvas code may cache `ImageData`; a participant cannot mutate the private canonical mask. `pivot`, `muzzle`, `hull`, `directionGuide`, `screenToWorld` and `angleFromPointer` enforce shared geometry and uniform scaling.

Aim updates are local immediately and coalesced to 10 Hz. Fire disables duplicates immediately and sends the exact final draft. The SDK retries a command at most twice with the same ID; changing turn/connection discards pending commands. Colyseus offline message buffering is disabled. A stale/missing terrain base triggers synchronization; clients never simulate an unaccepted outcome.

Clock sync uses monotonic `performance.now()` with server ping echoes. Offset corrections are smoothed and bounded to 5 ms/sample. Late timelines seek to the current cursor and omit old sound events. Visibility recovery requests a snapshot. Session storage holds the unguessable reconnect token for same-tab refresh; never log or share it.

Stats: RTT p50/p95, jitter defined as RTT p95−p50, input-to-ack p50/p95, ack-to-animation, clock uncertainty, estimated playback skew, resync count and render sampling frequency. RTT/2 is an uncertainty bound, not a measured one-way latency. FPS is a local sampling estimate, not a hardware guarantee.

Internal visual testing accepts `fixture: FixtureRecording` in the client configuration. A recording contains public state, packed terrain bytes, an optional accepted timeline and a label. This mode reports `connection: 'fixture'`, never connects or restores a session, and disables gameplay commands. The retired prototype's `/fixtures.html` viewer uses this mode; neither it nor this client implementation is distributed. Attendees receive only the JSON recordings and format documentation.
