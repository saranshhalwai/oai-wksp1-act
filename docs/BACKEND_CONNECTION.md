# Connect your own frontend to the deployed backend

This is the integration contract for protocol/rules/physics version 1. The reference pack includes documentation and recorded JSON data, with no frontend, game SDK, dependency bundle or runnable server. Your client implements the behaviors below.

## Address and transport

Use the HTTPS backend origin supplied by the host, with no path: `https://YOUR_HOST_DOMAIN`. Only your frontend runs locally. The host must allow its exact origin (scheme, hostname and port). Do not send cloud credentials or invent a backend API key. Check `GET /healthz`, `/readyz` and `/version`; readiness is 503 while room admission is draining.

The backend is Colyseus core 0.18.18, schema 5.0.36, using WebSockets. It is not a REST game API or a raw JSON WebSocket endpoint. Game message payloads below are carried inside Colyseus framing. A compatible general-purpose transport implementation is the publicly available `@colyseus/sdk@0.18.5`, which attendees may independently install. Despite that library's name, it is not the Artillery game SDK: it supplies no game state interpretation, terrain renderer, command manager or playback logic. No library is bundled in the reference pack.

The operation names below describe that transport library's interface, checked against the host's pinned version. Framework reference: https://docs.colyseus.io/client/. Do not assume examples for other versions match this release.

| Operation | Transport call / options |
|---|---|
| Configure | `new Client(backendOrigin)` |
| Create | `client.create('battle', { displayName, mode: 'workshop-quick' })` |
| Join a code | `client.joinById(roomCode.trim().toUpperCase(), { displayName })` |
| Practice | Create with `{ displayName, mode: 'workshop-quick', practice: true }` |
| Restore seat | `client.reconnect(savedReconnectionToken)` |
| Send game message | `room.send(messageType, payload)` |
| Receive game message | `room.onMessage(messageType, handler)` |
| Receive room state | `room.onStateChange(handler)` |

`mode` is `workshop-quick` or `standard`. Choose it only when creating. Use a display name of 1–24 characters. The returned room's `roomId` is the six-character room code. Compare `room.sessionId` with `state.players[].id` to find your current slot; recompute after rematches because sides swap. Third players and replacement seats are rejected.

Colyseus performs HTTP matchmaking at `/matchmake/create/battle` or `/matchmake/joinById/<code>`, then uses the returned reservation to establish its WebSocket transport. Let the transport handle this handshake, serializers and reconnection credential. There is no `/ws`, `/fire`, `/join` or `/state` JSON endpoint. Do not send these payload examples through a bare WebSocket without implementing Colyseus framing.

## Receiving state and terrain

Register message/state/error handlers as soon as the room is joined. Then send `room.send('resync')` to recover any snapshot that arrived before handlers were attached.

There are two different snapshots:

- The Colyseus synchronized schema has one field, `snapshot`, containing a **JSON string**. Parse it to obtain the public `GameState` described in BACKEND_TYPES.md. This update does not contain terrain bytes.
- The named `snapshot` message contains `{ state, terrain, timeline, serverTime }`. Here `state` is already an object; `terrain` contains the packed binary mask; `timeline` is the active accepted shot or null. `serverTime` is Unix milliseconds. Replace your committed base from this message and seek any included timeline.

Track committed state, committed terrain version and visual playback separately. Until a valid full terrain snapshot exists, show synchronization and disable gameplay. State and terrain messages can arrive separately; if versions do not converge, request resync instead of using mismatched data. Use the received terrain, not a locally generated landscape based on the seed.

Terrain is 1024×576 cells, row-major, one bit per cell. Exactly 73,728 bytes are sent. For cell index `i = y*1024+x`, occupancy is `(bytes[i >> 3] >> (i & 7)) & 1`. A value of 1 is solid. Preserve holes and overhangs; the bottom eight rows are bedrock.

Checksum is FNV-1a over the **589,824 unpacked 0/1 bytes**: start at 2166136261; for each byte b, compute `h = Math.imul(h ^ b, 16777619)`; format `(h >>> 0)` as eight lowercase hexadecimal digits, padding with zeroes. Reject a snapshot with the wrong length/checksum.

Named `patch` messages contain `{baseVersion,newVersion,bounds,spans,checksum}`. Apply to a copy of committed terrain only when `baseVersion` equals your version and `newVersion = baseVersion+1`. Every `[row,xStart,xEndExclusive]` span removes cells (sets them to zero). Bounds are `[x0,y0,x1,y1]` with exclusive ends. Validate integer coordinates, world bounds, bedrock exclusion and sorted non-overlapping spans; then validate the checksum before committing the copy. On failure, send `resync`. Empty patches still advance the version. Never apply the final patch early merely because it is included in a timeline.

## Commands and acknowledgments

Send all game actions as message type `command`. Use the latest state IDs, never values copied from examples:

```json
{
  "v": 1,
  "id": "a-new-unique-command-id",
  "matchId": "the-current-state-matchId",
  "turnId": 1,
  "type": "fire",
  "data": { "angle": 45, "power": 60, "weapon": "standard" }
}
```

IDs may contain 1–80 letters, digits, colons, underscores or hyphens; `crypto.randomUUID()` is suitable. `turnId` comes from current state, including ready/rematch/leave commands. Weapon keys are `standard`, `heavy`, `scatter`, `cluster`, `borer`.

| Command type | Data | When to send |
|---|---|---|
| `ready` | `true` or `false` | Waiting room; both ready starts countdown |
| `aim` | `{angle,power,weapon,seq}` | Your aiming turn; increasing integer seq per turn |
| `fire` | `{angle,power,weapon}` | Your aiming turn; captures final controls even if aim is pending |
| `move` | `"left"` or `"right"` | Your aiming turn, with tokens and no move yet this turn |
| `rematch` | Omit data | Finished match; both connected players must request |
| `leave` | Omit data | Explicitly forfeit/end your participation |

Angles are integers 0–180; powers 1–100. Send available weapon keys only. Keep local aiming responsive and coalesce aim updates (10 per second is sufficient). Do not transmit every animation frame. Limits are 40 messages/second/seat, 16 KiB incoming frames and 2 KiB command payloads.

The named `ack` message is `{id,ok,error?,serverTime}`. Track it by ID; `ok:false` contains a human-readable rejection. Accepted fire reserves ammo but does not mean the animation/result is complete. Show pending to prevent double fire. If retrying, reuse the exact envelope/ID. Never change its payload under the same ID or retry an old turn after reconnect. Errors include stale match/turn, unavailable weapon, wrong phase/player, missed deadline and blocked movement.

Disable gameplay during countdown, movement, calculation, playback, reconnect and after results. Deadline validation uses server receive time. The server automatically fires the last confirmed aim when time expires; clients do not trigger a second timeout shot.

## Server-driven animation

The named `timeline` message describes one accepted shot: `id`, `matchId`, `turnId`, `start`, `duration`, `baseVersion`, `tracks`, `events`, final `tanks`, final `patch` and score contributions. Require the matching match and committed terrain base. `start` is Unix milliseconds; sample/event `t` and `duration` are relative milliseconds.

Use `ping` with a finite numeric client timestamp. The server replies `pong` with `{echo,serverTime}`. With `performance.now()` timestamps, estimate RTT as receiveTime−echo and server offset as serverTime−(echo+receiveTime)/2; smooth corrections. Playback cursor is estimated server time−timeline.start. The aiming/countdown timer uses the same clock against state.deadline.

Interpolate between surrounding `(t,x,y)` samples in each track; draw a projectile only within its sample time range. Do not calculate a new trajectory or impact. Show an offscreen indicator when y<0. Use a separate visual mask copied from committed terrain. Apply each crater-bearing explosion/drill event once at its timestamp. Clear cells whose center `(x+0.5,y+0.5)` is within the event's `crater` radius, without removing bedrock. `radius` is the explosion effect/scoring radius and may differ from `crater`.

`settle` events identify `slot`, `fromY` and final `y`; animate over 350 ms. State `movement` separately carries a slot, start, duration and ordered path points for voluntary movement. At the server's turn boundary, adopt authoritative state/patch/tanks/scores together. Your animation finishing must never advance a turn or invent a score.

For late packets or a resumed tab, seek to the current cursor and apply earlier visual terrain edits once. Suppress old sounds/effects instead of replaying them. Replace visual terrain from the committed base after recovery. Deduplicate timeline and event IDs. Bound work: current timelines have at most 8 tracks, 400 samples per track and 512 events.

## Recovery, results and geometry

Store `room.reconnectionToken` privately in session storage for refresh recovery. Reconnect within the server's 20-second grace; deadlines continue during disconnection. Refresh the saved token after reconnect. Disable queued gameplay while offline (`room.reconnection.maxEnqueuedMessages = 0` in the pinned transport), discard pending drafts/commands and request `resync` after reconnect or visibility recovery. Listen to transport drop/reconnect/leave/error events and show their state. If recovery fails, offer a new room. Do not silently occupy a new seat and call it a recovery.

Explicit leave should clear the saved token and close the transport deliberately; do not send a forfeit from a page-unload handler if refresh should reconnect. A named `server-error` indicates shot calculation failed; show the authoritative aborted state. Result winner is a player slot or null; phase distinguishes a draw from an aborted game. A server restart loses in-memory rooms/tokens.

In a waiting room, display each seat's `name`, `ready` and `connected` fields, including an open-seat placeholder. Readiness can be cancelled before countdown. Keep a leave/back-to-lobby action available without a blocking Ready dialog. A deliberate leave during waiting/countdown aborts the room with a `Room disbanded` reason and no winner; replacement players cannot join. A temporary disconnect still allows the 20-second reconnect grace. An old code may return Colyseus error 522 (missing, disposed or locked room); explain that the room is unavailable and offer create/join again. Do not treat it as a new seat or invent a successful join.

Use uniform scaling for the complete 1024×576 world. Coordinates have x right/y down. A tank `(x,y)` is centered horizontally at the bottom of its 28×16 hull: `[x−14,x+14] × [y−16,y]`. Pivot is `(x,y−15)`; muzzle is pivot plus `(20*cos(angle),−20*sin(angle))`, with degrees converted to radians. The allowed direction guide extends 55 units from the pivot, independent of power. Artwork must not change these physical positions.

Acceptance: complete a quick match against a host demo or another attendee on the deployed backend, compare scores/tanks/inventory/checksum at committed boundaries, and refresh during flight. Recordings are labeled fixtures, never real competitive outcomes.
