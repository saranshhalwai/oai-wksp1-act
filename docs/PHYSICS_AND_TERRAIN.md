# Physics and terrain

World 1024 × 576, origin top-left, positive y downward. Solid occupancy is one unit per cell. Initial terrain is seeded, left/right symmetric and flat around equal-height spawns x=140/884. Bottom eight rows are indestructible bedrock. Removal preserves tunnels and overhangs; terrain does not behave like sand or fill holes.

Tank hull is `[x−14,x+14] × [y−16,y]`; pivot `(x,y−15)` and barrel length 20. Cosmetic artwork cannot alter the collider. Settling checks each one-unit downward sweep and stops at first contact. Spawn and final positions must be clear and supported.

Physics uses semi-implicit Euler at 120 Hz: update vx by wind×dt and vy by 180×dt, then advance position. Launch speed is `100+4*power`. Sweep the radius-2 projectile along each step with spacing ≤0.5 unit, testing circle-versus-cell and nearest hull distance. At equal sample time: tank slot order precedes terrain. This is a bounded deterministic sampled sweep (contact position resolution ≤0.5 unit), not an analytic continuous-time solver.

The shooter is ignored until the projectile clears its initial hull area; returning shots can self-hit. Blocked muzzle resolves at time zero. x outside [0,1024) misses; y above the screen remains live, bounded at −2048. Simulation expires after 12 seconds. Expiration never invents an explosion. Server results are repeatable for identical input on this runtime; browsers do not reproduce floating-point physics.

Tracks include samples near 30 Hz plus exact sampled contact/split points. Events are stable and ordered, with unique IDs. All tanks stay still while hits score, then settling is animated. Borer cuts are 1-unit increments, radius 6, at 5 ms/event for up to 60 units; tanks, bedrock and boundaries stop the drill.

Binary snapshot: 73,728 bytes, bit i is cell i with least-significant-bit-first packing. Checksum: unsigned FNV-1a over the unpacked 0/1 bytes, eight lowercase hex characters. Removal patches carry `baseVersion`, `newVersion`, `[x0,y0,x1,y1]` exclusive bounds, sorted `[row,xStart,xEndExclusive]` spans and final checksum. Implement your client to apply to a copy, validate every bound/version/checksum and request a fresh snapshot on failure. The canonical mask is never taken from rendered pixels. See BACKEND_CONNECTION.md for the decoding and checksum algorithms.

Render the received occupancy mask with exact edges and keep backdrop hills visibly separate. You may cache its image and update changed regions as an optimization. Physics details above explain server behavior; clients animate received results and do not calculate official impacts or scores.
