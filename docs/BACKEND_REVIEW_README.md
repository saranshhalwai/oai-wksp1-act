# Artillery Lab backend: capabilities, authority and cheating review

Reviewed: 8 October 2026. Scope: the current host repository, including the waiting-room fixes confirmed by the user. This report describes implementation, not merely the original project prompt.

Only this report was added for this request. No application code, configuration, dependencies or existing documentation was changed. No deployment, live-room attack, load attack or penetration test was performed for this review.

## 1. Main conclusion

**The backend controls official game outcomes, but it does not make an arbitrary participant frontend cheat-proof.**

A frontend cannot simply submit a score, teleport a tank, add ammunition or declare a hit through the implemented command interface. It submits choices; the backend validates those choices and calculates the result.

However, a frontend author can build an aim solver, automate legal commands, inspect an opponent's confirmed aim, reveal an accepted shot's final outcome early, or display misleading information. The backend cannot establish that a human chose the submitted angle/power or that a browser renders the game honestly.

There are also concrete implementation gaps beyond that inherent limitation. Most notably, generic Colyseus matchmaking remains enabled: an available room can be selected without its six-character code. Other concerns include shared capacity exhaustion, repeated full-snapshot requests, incomplete runtime type checks, and edge cases around explicit leave/reconnect and rematch connectivity.

This is an authoritative workshop game with useful protections against forged outcomes. It is not an authenticated, abuse-resistant tournament platform. A fair human-only competition needs explicit workshop rules and review in addition to server validation.

## 2. Evidence and confidence

This was a source review of application code, installed framework code, configuration and existing tests. Findings below distinguish:

- **Implemented:** directly present in the current source.
- **Source-confirmed gap:** a missing check or exposed behavior is visible in the implementation; this review did not exercise it against live rooms.
- **Risk requiring verification:** impact depends on transport timing, deployment or load and needs a targeted test before stronger claims.

Existing verification from the preceding implementation work included 29 unit/integration tests, five browser tests, builds and four network-delay profiles. The user also confirmed that the updated game flow works. Those checks support functional correctness of their covered scenarios; they do not prove absence of cheating or security defects. The newly identified abuse scenarios were not all covered by those tests.

Primary sources:

| Source | Responsibility reviewed |
|---|---|
| [Server transport](../apps/server/src/index.ts) | Room creation/join, transport-seat mapping, messages, Origin policy, HTTP routes, admission, reconnect and shutdown |
| [Game engine](../apps/server/src/engine.ts) | Command checks, phases, clocks, inventory, movement, scores, results, leave and rematch |
| [Protocol and constants](../packages/protocol/src/index.ts) | Public data, modes, weapons, geometry and aim validation |
| [Physics](../packages/physics/src/index.ts) | Projectile simulation, collisions, weapons, score calculation and bounds |
| [Terrain](../packages/terrain/src/index.ts) | Seeded map, occupancy, movement support, settling, patches and checksums |
| [Worker pool](../apps/server/src/pool.ts) and [worker](../apps/server/src/worker.ts) | Simulation isolation, queues and failure handling |
| [Internal demo client](../packages/client-sdk/src/index.ts) | Client-only restrictions, playback, recovery and presentation boundaries |
| [Caddy configuration](../deploy/Caddyfile) and [production Compose](../deploy/compose.yaml) | Intended proxy isolation and production exposure |
| [Engine tests](../tests/integration/engine.test.ts), [transport tests](../tests/integration/transport.test.ts), [failure tests](../tests/integration/failure.test.ts) | Existing regression coverage |
| [Connection contract](BACKEND_CONNECTION.md), [protocol](PROTOCOL.md), [test report](TEST_REPORT.md) | Integration documentation and previously recorded evidence |

Installed Colyseus core 0.18.18 was also inspected, especially `build/matchmaker/controller.mjs`, `build/MatchMaker.mjs` and `build/Room.mjs`. These dependency files are installed locally, not authored application code.

## 3. What the backend provides

The host runs a Node/Colyseus service with in-memory rooms and a bounded worker-thread pool. Attendees build their own frontend and connection/rendering logic. No game-specific SDK or frontend is required to be trusted by the backend.

### Connection and room services

| Capability | Current behavior |
|---|---|
| Create room | Creates a `battle` room, generates an unused six-character code, accepts display name, preset and optional practice flag |
| Join room | The documented flow joins by room code; framework generic join methods also exist, discussed below |
| Player slots | Two players maximum; practice fills one slot with the server bot |
| Seat identity | Commands are attributed by the connected client's Colyseus `sessionId`, not a submitted player/slot field |
| Names | Strings up to 24 characters; trimming and fallback names occur in the engine; names are not unique identities |
| Readiness | Each player's ready/connected state is published; both ready and connected starts a three-second countdown |
| Temporary recovery | A dropped connection can recover its seat using a reconnect credential within 20 seconds |
| Explicit departure | Waiting/countdown departure disbands the room; active-match departure follows forfeit/commit policy |
| Room expiry | Waiting rooms have a ten-minute age limit; total room lifetime is 45 minutes from creation, including rematches |
| Rematch | Both players request it; positions/player slots swap, inventory/scores reset, terrain regenerates and a new match ID is assigned |
| Practice | A clearly identified server bot makes legal shots using a simple distance-based estimate plus random error |

There are no player accounts, passwords, authenticated attendee roster, persistent match database, ranking system, spectator mode, host approval of entrants, or durable match recovery after server restart.

### HTTP and realtime interface

| Interface | Purpose and authority |
|---|---|
| `GET /healthz` | Minimal liveness response |
| `GET /readyz` | Reports whether admission is draining; this is not a full capacity/dependency health assessment |
| `GET /version` | Protocol, rules, physics and build versions |
| Colyseus `/matchmake/...` | Seat reservation/bootstrap; not a generic REST game API |
| Colyseus WebSocket connection | Carries commands, synchronized state and game events |
| `command` message | Submits ready, aim, move, fire, rematch or leave |
| `resync` message | Requests committed state, packed terrain and the active timeline |
| `ping` / `pong` | Supplies timing data for client clock estimation and RTT measurement |
| `ack` | Reports command acceptance/rejection by command ID |
| `timeline` | Supplies accepted projectile tracks, effects, final patch/tanks and score contributions |
| `patch` | Supplies committed terrain changes between versions |
| `snapshot` | Supplies full state, terrain, active timeline and server time |
| `server-error` | Reports simulation failure; the match is aborted rather than trusting client results |

The synchronized Colyseus schema contains a JSON-string `snapshot` field. The named `snapshot` message instead contains an object with binary terrain. Implementers must distinguish these two representations.

There is no supported client endpoint for setting a score, replacing terrain, editing tank coordinates, changing gravity, spawning arbitrary weapons, granting ammo, or declaring a winner.

## 4. Game rules the backend controls

### Presets and inventory

| Rule | Workshop quick | Standard |
|---|---:|---:|
| Shots per player | 5 | 10 |
| Aiming time | 20 seconds | 30 seconds |
| Move tokens | 3 | 6 |
| Standard shells | 2 | 3 |
| Heavy shells | 1 | 2 |
| Scatter volleys | 1 | 2 |
| Airburst clusters | 1 | 2 |
| Borer shells | 0 | 1 |

Both players receive identical inventory. There is no weapon purchase, draft or frontend-defined weapon registry. The creator chooses a preset; the command API cannot subsequently change it.

The server chooses first-player priority randomly. Players alternate, with the same player starting each round. On rematch the array of players is reversed while first-slot priority stays the same, making the previous second player start. Wind is a server-selected integer from -25 to +25 horizontal acceleration units, refreshed once per round and shared by both shots.

### Aim and timing

- Angle must be an integer in 0–180 degrees: 0 right, 90 up, 180 left.
- Power must be an integer in 1–100. Speed is `100 + 4 * power` world units/second.
- Defaults are angle 45 for the left tank, 135 for the right, power 60.
- A fire command includes final aim/weapon values. It does not depend on a separate aim update arriving first.
- Server time determines deadline acceptance. A client timestamp cannot extend a turn.
- At timeout, the server fires the last confirmed legal aim/weapon. If the previously selected weapon is exhausted, the engine selects a remaining weapon when opening the turn.
- A browser pausing its animation, changing its clock, hiding its tab or suppressing its own timeout UI does not stop the server's clock.

### Movement, world and terrain

The battlefield is 1024 by 576 units. Terrain is a real occupancy mask, not a cosmetic heightfield. Initial terrain is seeded and symmetric with equal spawn support. The bottom eight rows are indestructible bedrock.

Tank hulls are 28 by 16 units. Tank coordinates identify the horizontal center and bottom of the hull; the barrel pivot is 15 units above that point and barrel length is 20 units. A frontend may draw different artwork but cannot change the collision geometry.

A legal move is left or right, up to 24 units, at most once before the shot in each turn. The server walks the path in one-unit horizontal increments, checks hull clearance/support and permits at most six units up or twelve down per increment. Left and right tanks remain in separate side ranges. A zero-distance move consumes no token. An accepted move enters a 350 ms movement phase; firing remains locked and the turn deadline keeps running.

Explosions/drilling remove mask cells. Holes and overhangs remain; removed ground does not refill. Tanks settle down onto support after shot impacts resolve. There is no fall damage or health-based elimination.

### Physics and weapons

The server runs a fixed 1/120-second simulation, updates velocity before position, applies gravity 180 and the current wind, and checks the swept projectile path in samples no more than 0.5 units apart. Collision uses a projectile radius of two units and canonical tank hulls. The shooter is ignored initially until the projectile clears its own hull area; a later return can hit it.

This is deterministic sampled collision logic, not a claim of exact continuous analytic collision detection. Tanks win contact ties ahead of terrain in the implemented check. Projectile processing uses stable array order.

| Weapon | Server behavior | Explosion radius / maximum contribution / crater radius |
|---|---|---|
| Standard | One projectile | 36 / 40 / 30 |
| Heavy | One projectile, wider blast | 54 / 65 / 48 |
| Scatter | Three simultaneous projectiles at -6, 0, +6 degree offsets; one ammo item | 24 / 18 / 20 per explosion |
| Cluster | One apex split into five children; fixed velocity offsets | 22 / 16 / 18 per child |
| Cluster early impact | Main projectile hits before splitting | 24 / 20 / 20 |
| Borer | Radius-six drill corridor, up to 60 units, followed by explosion; stops at tanks/bedrock/boundaries | 34 / 35 / 30 |

Shots are bounded to 1,440 physics steps, with additional bounded effect/settling time. Flight above the top edge is permitted; world-side exit or excessively high flight terminates the projectile. No client-provided script runs as a weapon handler.

### Scoring and results

For each explosion the engine computes distance `d` from its center to the nearest point of each tank hull:

```text
contribution = round(maxScore × max(0, 1 − d / explosionRadius))
net shooter points = opponent contributions − self contributions
```

Multiple explosions add together. Direct hits have no separate bonus. Terrain does not shield blast scoring. Negative scores are possible. Being hit does not directly reduce the non-shooter's score; the shooter receives the opponent-hit points.

After all shots, higher score wins and equal totals draw. Official results are produced by server completion/forfeit/abort policy. A reported client animation-complete event cannot advance the turn.

## 5. What happens when a frontend presses Fire

1. The server maps the connection to its player seat.
2. It checks protocol, command identity, current match/turn, connected seat, phase, active player, receive-time deadline, numeric aim and ammunition.
3. It immediately changes phase to `calculating`, records the aim, consumes one ammo item and increments shots. This closes the normal duplicate-fire window.
4. It submits copied terrain/tanks and accepted parameters to the worker pool.
5. It rejects stale worker completion if the match/turn/phase no longer matches or the game has already ended.
6. It broadcasts a timeline scheduled roughly 150 ms ahead. Clients animate this accepted result.
7. At playback completion, it commits terrain, tank positions and score in one engine transition, publishes the patch and opens the next turn or finalizes the result.

Network packets are still separate: an independent frontend must reconcile state and terrain versions rather than assume one indivisible network message. The authoritative mutation is on the server.

On worker failure, the engine aborts without applying a partially calculated terrain/score result. Reserved ammo/shot count is not rolled back into a playable match; there is no continued match to exploit for a free retry.

## 6. Input protection and its limits

| Check | What it prevents | Important limit |
|---|---|---|
| Connection-to-seat mapping | Supplying an opponent slot to act as them | Does not authenticate the human operating the connection |
| Match and turn IDs | Applying ordinary old-turn or old-match actions | IDs are public consistency fields, not secrets |
| Phase and active-seat checks | Firing out of turn or during movement/calculation/playback | Do not establish human input |
| Aim range and ammo checks | Excess power, unsupported ordinary weapon IDs, spent ammunition | Runtime payload typing is incomplete; see findings |
| Command cache | Duplicate accepted actions while their IDs remain cached; conflicting payload reuse | Holds 256 outcomes per engine, not permanent audit history |
| Increasing aim sequence | Old aim revisions replacing newer ones in a turn | Not a human-behavior validator; integer checks are not safe-integer checks |
| Server deadline | Extending aiming time with browser clocks | No fairness compensation for a slower player's network |
| Worker and phase guards | Late jobs committing a new or terminal match | Do not protect all connection lifecycle edges |
| Terrain checksum/version | Detecting accidental divergence in a cooperating frontend | FNV checksum is not cryptographic attestation of the browser |

After cache eviction, normal phase/turn checks still prevent replaying an old fire as an extra shot. The cache limit alone is not evidence of a double-fire exploit.

## 7. Information every connected frontend receives

The public state includes both players' names, IDs, seats, ready/connected flags, inventories, move tokens, shot counts, scores and confirmed aim; tank positions; terrain seed/version/checksum; active player, wind, round, phase, deadline, match/turn IDs; recent history; and result.

Full snapshots contain the packed 73,728-byte terrain mask. An accepted timeline includes the final terrain patch, final tank positions and score contributions before playback finishes.

Consequences:

- An independent frontend has enough world information to implement an aiming assistant or reconstruct a simulator from the documented rules.
- It can display the opponent's **server-confirmed** angle, power and weapon. Unsent local drafts are not visible.
- It can reveal the accepted shot's outcome early and start planning from its final map. It cannot change that already accepted shot or send a valid next-turn action early. Future round wind is still selected when the round starts.
- Hiding fields in Neon/Paper does not remove them from the network.
- Removing the host's SDK from attendee distribution does not prevent assistance: the data and rules themselves are public to clients.

Public player IDs are not the private reconnect credential. Seeing an ID is not, by itself, evidence that another seat can be taken over.

## 8. Practical cheating matrix

| Attempt by a frontend author | Can the current implementation permit it? | Effect |
|---|---|---|
| Submit `score: 9999`, invented hit coordinates or a terrain patch | No supported authority path | Such fields do not become official outcomes |
| Fire with power 999 or a fractional angle | Rejected by normal aim validation | No official shot accepted |
| Fire twice by sending different command IDs | Phase/turn lock prevents normal double fire | IDs alone do not grant another shot |
| Move by supplying arbitrary x/y | Not a supported move payload | Server accepts only left/right |
| Change gravity, explosion radius or grant ammo | Not a supported command | Requires backend changes |
| Act as the opponent by putting their player ID in a command | Not through implemented seat mapping | Transport identity is used |
| Stop turn progression by not finishing animation | No | Server-controlled playback/deadlines continue |
| Use a full trajectory guide or best-shot solver | Yes, as an external/client computation | Unfair assistance if workshop rules prohibit it |
| Automatically send legal aim/fire/move commands | Yes | Server cannot distinguish human clicks from automation |
| Read the opponent's confirmed aim/inventory | Yes | Already public state; UI can expose more than demos |
| Reveal the final crater/score at shot acceptance | Yes | Timeline contains final outcome before playback ends |
| Falsify the local scoreboard or show fake victory | Yes, locally | Cannot change honest peer/server state, but can mislead screenshot-based judging |
| Hide practice mode or bot labels | Yes, locally | Server retains `practice` and `bot` flags; a screenshot alone can conceal them |
| Occupy both seats using separate clients | Yes | No one-person-one-seat identity policy |
| Enter an open room without knowing its code | Source shows generic matchmaking path | Code-only privacy is not enforced |
| Flood shared admission or repeatedly request snapshots | Partially bounded, not eliminated | Availability/cost risk; no measured exploit impact in this review |

If the workshop permits innovative aim assistance, a solver is a permitted feature rather than cheating. The host must define that policy. The backend cannot infer the intended judging rules.

## 9. Specific gaps found in the current implementation

Priorities below are suggested host-review priorities, not externally assigned vulnerability scores. Recommendations describe possible future work only; none was implemented for this report.

### A. Generic matchmaking bypasses the room-code-only assumption

**Priority: high for private partner rooms. Source-confirmed gap.**

The application registers `server.define('battle', BattleRoom)` without a private-room setting, custom admission authentication or restriction of framework matchmaking methods. The installed controller exposes `join`, `joinOrCreate`, `create`, `joinById` and `reconnect`. Its generic lookup selects an unlocked, non-private room by room name and filters.

Therefore a custom client can request an available `battle` seat through generic matchmaking instead of entering a specific code. This does not bypass the two-seat cap or steal an already occupied seat, but it can occupy someone else's waiting-room opponent slot. Because a pre-match departure disbands the room, unwanted entry can also disrupt a planned partner session.

The six-character code is useful for routing people to the same room; it is not currently an access-control boundary. Even after generic matchmaking is restricted, a code alone would not authenticate an invited human.

Potential future direction: explicitly restrict public matchmaking operations, mark rooms private where appropriate, and use a separate invitation/admission policy if private matches matter. Verify all reservation paths, not just the documented UI path.

Evidence: server registration in `apps/server/src/index.ts`; installed core's `controller.exposedMethods`, `join`, `joinOrCreate` and `findOneRoomAvailable`.

### B. Automation and full-trajectory assistance cannot be blocked by present authority checks

**Priority: high for human-only competitive judging. Deliberate trust-boundary limitation.**

The server checks whether a move/shot is legal, not how it was selected. It has no client integrity verification, human-input attestation or behavior-based aim-assistance detection. Public physics and terrain permit an external implementation even without the internal client SDK.

Potential future direction: enforce a workshop policy through source review and supervised play. Do not advertise that removing helper functions, disabling browser controls or obfuscating the frontend makes automation impossible.

### C. Shared admission and room capacity can be consumed by one participant

**Priority: high for an untrusted public event. Source-confirmed exposure; disruption magnitude unmeasured.**

Default capacity is 50 rooms and the HTTP creation/admission window is an aggregate 300 attempts/minute. There is no authenticated per-attendee quota. A single operator can run many clients and compete for the same room budget as legitimate users.

`autoDispose` is disabled, and a waiting room is aged out at ten minutes. Failed/incomplete joins or reservations also deserve testing: room creation precedes display-name validation in `onJoin`, so checking a name is not the same as preventing resource allocation for a failed attendee session.

Join/reconnect traffic is not covered by the application's creation-specific counter in the same way as create/joinOrCreate. The room cap is a useful bound, not comprehensive denial-of-service protection.

Potential future direction: attendee-scoped admission quotas, bounded reservation/empty-room retention and measured HTTP/connection limits that account for a shared campus IP. Do not run an abuse rehearsal against active workshop matches.

### D. Full resync requests are expensive relative to their input

**Priority: medium to high for availability. Source-confirmed gap; load impact unverified.**

Every accepted `resync` calls `snapshot`, which repacks terrain and sends at least 72 KiB of terrain plus state/timeline. The room configures approximately 40 incoming messages/second per client, but has no separate resync cooldown, byte budget or snapshot coalescing on the backend.

The demo client's 400 ms request throttle is client-side and a custom client can omit it. For scale only, 40 × 73,728 is about 2.8 MiB/second of raw terrain per seat before protocol/timeline overhead; this is arithmetic, not measured sustainable throughput or an exact framework boundary guarantee. Many seats multiply the work. Packing also runs on the room thread, outside the physics pool.

Potential future direction: backend-specific resync limits, reuse of packed committed terrain and outgoing-byte/backpressure controls.

### E. Runtime payload validation is not a strict schema

**Priority: medium for robustness. Source-confirmed gap; no demonstrated arbitrary score change.**

Examples visible in source:

- `validAim` checks `Object.hasOwn(WEAPONS, v.weapon)` without first requiring a string. JavaScript coerces property keys; a one-element array containing a known weapon name can pass the lookup while violating the advertised `Weapon` type.
- `command` tests `c.id` with a regular expression without first requiring a string. Regular expressions coerce their input; an absent ID becomes the text `undefined`, which fits the allowed-character pattern. The ack ID separately falls back to an empty string. This weakens the advertised ID contract and client correlation, even though ordinary turn/phase checks still apply.
- An `aim` command checks that `seq` is an integer, not a safe integer or a bounded value.
- `fire` copies the accepted aim object with object spread rather than reconstructing only angle/power/weapon. Extra fields can therefore be echoed into public `player.aim`; they do not overwrite the separately stored player score or tank position.
- Creation options are not validated by a complete runtime schema, and empty names are normalized to a fallback despite the stated 1–24-character contract.

Potential consequences include unexpected public-state shapes, incompatible third-party clients, larger replicated data and confusing acknowledgments. There is no evidence here that these examples enable arbitrary code execution, unlimited ammunition or forged official scores.

Potential future direction: validate complete runtime schemas, require exact scalar types and safe integer bounds, reject unknown fields where appropriate, and copy only canonical validated fields.

### F. Explicit leave and temporary disconnect are not stored as distinct terminal intentions

**Priority: medium. Source-confirmed state-model gap; full transport exploit needs testing.**

The engine represents both using `connected=false` and an absence deadline. Explicit leave sets the deadline to now; a drop sets it to the reconnect-grace deadline. `connect()` unconditionally removes the absence entry. There is no persistent explicit-leave flag.

During waiting/aiming, explicit leave normally finalizes immediately. During calculating/playback/movement, terminal handling is deferred. In that window, a later drop/reconnect can potentially replace or clear the explicit departure intent before finalization. The public `leave` command itself does not close the transport; the honest UI closes it separately.

This should be investigated as a lifecycle/policy bypass, not described as a proven score-forgery exploit. A finished result is still protected from later overwrite.

Potential future direction: distinguish irrevocable explicit departure from recoverable transport loss and test leave/drop/reconnect races around playback commit.

### G. Connected flags can be stale after final results

**Priority: medium for rematch correctness. Source-confirmed gap.**

`disconnect()` returns immediately when `state.result` exists, before updating the player's connected flag. `rematch` uses those flags to require both players to be connected, and the engine retains rematch votes.

Consequently the result screen may show a departed player as connected. If that player had already voted for a rematch, the remaining player's vote can potentially reset a match with an absent opponent. Exact transport outcomes need a focused test. This is a rematch/connectivity problem; it does not alter the previous result.

Potential future direction: keep connection presence current after results and invalidate/remap rematch consent when a player departs.

### H. Waiting-room readiness can stall after recovery in a particular order

**Priority: low for usability. Source-confirmed transition gap.**

Countdown starts inside the `ready` command when both players are ready and connected. `connect()` republishes presence but does not reevaluate that condition. If one ready player disconnects and the other marks ready during the absence, recovery can leave both ready/connected while still waiting. Toggling readiness again can start the countdown.

This does not grant extra shots or points, but deserves a focused reconnect/readiness test.

## 10. Origin, identity, credentials and admin access

### Origin checks

HTTP and WebSocket admission reject nonempty origins outside `ALLOWED_ORIGINS`. This protects against ordinary browser pages on unapproved origins. Requests without an Origin are accepted, and non-browser clients can choose that header themselves.

Origin is therefore a browser-origin policy, not proof of attendee identity or official frontend code. An approved localhost origin also does not establish which person or script is using it.

### Reconnect credentials and display names

Reconnect credentials are bearer credentials: whoever possesses one may be able to recover the corresponding seat under the transport's reconnect policy. The backend relies on Colyseus for token checking. Display names provide no authentication and can be duplicated.

A participant who runs their own frontend controls its JavaScript, storage and dependencies. A malicious frontend could mishandle or disclose its user's reconnect credential. Use trusted frontend origins/code for competitive sessions, do not include tokens in screenshots/logs, and verify HTTPS/WSS before public play. This review found no basis to claim a room code or public player ID alone grants an occupied seat.

### Administration

`GET /internal/metrics` and `POST /internal/drain` use the TCP peer's loopback address as their access check. Drain stops admission; forced drain also aborts rooms. No administrative token is required for a loopback caller.

The intended production setup keeps the game port on the Compose network and has Caddy deny `/internal`, `/metrics` and `/admin` paths. That is a meaningful deployment boundary. A future proxy change that forwards admin routes from a trusted loopback peer could invalidate the assumption, so route denial and network exposure must be tested together.

No public cloud exposure, TLS trust or final Docker/proxy behavior is certified by this report. Local Docker verification remains pending from the previous work.

## 11. Resource bounds, operations and persistence

| Control | Current implementation |
|---|---|
| Incoming WebSocket payload | 16 KiB transport setting |
| Game command size | At most 2,048 characters of `JSON.stringify(command)` in the application check; not a precisely defined UTF-8 byte limit |
| Incoming room rate | `maxMessagesPerSecond = 40`, enforced by installed Colyseus per connection |
| HTTP body guard | Rejects a declared Content-Length above 16 KiB; this application check alone is not proof of a universal limit for chunked/undeclared bodies |
| Default rooms | 50, configurable; a capacity setting, not a demonstrated throughput guarantee |
| Default physics workers | 1, configurable |
| Default queued jobs | 32, configurable |
| Worker execution deadline | 2 seconds; failing slot is terminated/replaced |
| Queue waiting bound | Jobs older than 5 seconds are rejected when dispatched; this is not an independent timer guaranteeing removal at exactly 5 seconds |
| Simulation limits | 1,440 steps, at most five live projectiles, at most 512 events |
| Retained metrics | Last 1,000 calculation/queue samples |
| Shot history | Last 20 entries |
| Shutdown | Stops admission, waits up to 30 seconds, then aborts outstanding games and closes workers/server |

Metrics include worker activity/errors, queue/calc durations, room/player counts, process memory and event-loop delay. Outgoing byte accounting is approximate: it uses some JSON string lengths and a fixed terrain amount for snapshots, not exact wire bytes. These counters should not be treated as complete bandwidth billing or a forensic audit log.

The backend does not persist live rooms, authoritative replay records, player accounts or match results to a database. Restart/VM loss ends live sessions. A container restart policy brings the service back, not the interrupted matches. Browser RTT/FPS statistics are supplied by the client implementation and are not trusted anti-cheat evidence.

## 12. What a frontend creator may innovate without backend changes

| Frontend change | Works against the same backend? | Constraint |
|---|---|---|
| Theme, tank art, backgrounds, UI layout | Yes | Official collision geometry remains fixed |
| Keyboard, sliders, touch controls, accessibility | Yes | Submit the same legal integer inputs/actions |
| Sound, particles, animations, reduced motion | Yes | Effects cannot advance official time or change outcomes |
| Shot history, statistics, clearer readiness/wind | Yes | Use server data and distinguish estimates from official facts |
| Different game connection implementation | Yes | Must implement transport, validation, timing and recovery correctly |
| Aim solver, predicted trajectory, automation | Technically possible | Requires an explicit workshop fairness decision |
| Health bars as decorative art | Technically drawable | Would misrepresent this score-based game if presented as real health |
| New weapons, different damage/points, altered gravity | No official effect | Requires a backend rules change |
| More players, custom movement, arbitrary map edits | No official effect | Requires backend implementation and protocol changes |

The backend provides authoritative data, not a remotely enforced UI. A beautiful but incorrect frontend can still hide information, draw terrain incorrectly, mislabel points or fail to recover. Cross-frontend state comparison remains an integration requirement.

## 13. Recommended host decisions and future checks

Before presenting the game as a fair human-only competition:

1. Decide whether aim assistance, automation and early outcome display are allowed. Publish that policy alongside the backend contract.
2. Decide whether rooms are public matchmaking or invitation-only. The current room-code UI suggests stronger privacy than the backend enforces.
3. Judge results using a trusted host view or independently observed authoritative state, not a participant's screenshot alone. There is currently no signed result certificate or durable audit service.
4. Prioritize generic matchmaking restrictions, attendee-scoped admission and backend resync limits if participants are not fully trusted.
5. Add targeted tests for strict payload shapes, explicit-leave recovery races, result-screen departures/rematches and both-ready reconnect ordering before claiming those paths are hardened.
6. Verify production proxy isolation, HTTPS/WSS, connection limits and separate-machine capacity before exposing an event backend.

These are recommendations only. The user requested analysis, so no fixes or changes implementing them were made.

## 14. Answer to the loophole question

**Yes, a frontend creator can gain an unfair advantage under human-only rules while sending entirely legal commands.** Automated aiming is the clearest example. They can also expose information that the sample UI does not show, spoof the local presentation, control multiple seats, or exploit the generic matchmaking exposure to enter an available room without its code.

**No direct supported command lets them choose the official score, impact, terrain, ammo or tank position.** The implemented authority checks are valuable and substantially stronger than trusting frontend-calculated results. The gaps identified here concern fairness, admission, robustness and lifecycle behavior; they should not be confused with a demonstrated arbitrary-outcome exploit or with a guarantee that no further bugs exist.
