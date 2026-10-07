# Architecture

One Node process owns all rooms in memory. Colyseus 0.18 handles matchmaking, seats, WebSockets, reconnect credentials and schema updates. A small schema string contains the public room snapshot; terrain and timelines use separate reliable messages. This trades fine-grained schema deltas for a simple bounded workshop protocol.

`protocol` defines data and geometry. `terrain` stores a 589,824-cell binary mask and exports bit packing, checksums and removal patches. `physics` contains deterministic headless shot solving. `server/engine.ts` owns gameplay transitions independently of transport. `pool.ts` admits bounded immutable jobs to Node worker threads. The host demos share an internal client implementation. Attendees receive only backend documentation/data and implement their own clients against the deployed Colyseus protocol; neither SDK nor frontend/backend runtime code is distributed.

Committed state and animated state are distinct. During calculation/playback, committed terrain, positions and scores stay fixed. Clients apply ordered visual crater/drill events against a separate copy. At the server's playback boundary, terrain patch, tank positions and scores commit together, and the next turn opens. Client frame rate or an animation-complete message cannot advance a match.

State machine: waiting → countdown → aiming → [moving → aiming] → calculating → playback → aiming/finished. Server errors or both players absent cause aborted. Result writes are guarded; stale worker results cannot overwrite a terminal state.

Admission defaults: 50 rooms, one worker, 32 waiting jobs. A job has a 2-second running deadline and a 5-second queue-age limit. Physics bounds: 1,440 fixed steps, at most five simultaneous projectiles, 512 events and eight tracks. The job pool replaces failed workers, rejects excess load, and aborts affected matches without partial score/terrain commits. Production limits must be tuned from deployment measurements.

Single process/VM failure loses live rooms. Container restart, disk snapshots and reconnect credentials do not persist JavaScript room state. Future horizontal scaling requires authoritative room placement, not just sticky sessions. This baseline has no Redis or database.
