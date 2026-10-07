# Rules, version 1

These are original workshop rules, not a replica of a commercial service. Tanks have scores, not health. Highest score after all shots wins; equality is a draw. Negative scores are possible.

| Preset | Shots/player | Deadline | Move tokens | Standard / Heavy / Scatter / Cluster / Borer |
|---|---:|---:|---:|---|
| workshop-quick | 5 | 20 seconds | 3 | 2 / 1 / 1 / 1 / 0 |
| standard | 10 | 30 seconds | 6 | 3 / 2 / 2 / 2 / 1 |

Both players ready starts a three-second countdown. A server coin toss chooses the match's first player, who remains first each round. Wind changes once per round and applies to both shots. A rematch swaps physical sides and first-player priority.

Global angles are integer 0–180 degrees: right 0°, up 90°, left 180°. Power is integer 1–100, speed `100 + 4 × power` units/second. Initial settings are 45°/135° and power 60. Accepted settings persist; exhausted weapon selections fall back to the first available weapon. The short direction guide is independent of power. Competitive clients may not show full trajectories, landing predictions or automated aiming.

One optional move per turn walks up to 24 units and spends one token only if movement succeeds. Each swept step may rise at most 6 or fall at most 12 units. Sides cannot swap. Fire is locked for the 350 ms movement animation; the deadline continues. If it expires during movement, the accepted move finishes then auto-fire happens once.

At the deadline the server fires the last confirmed aim/weapon. A fire received at or after that time loses the race. Accepted fire consumes exactly one ammo even on a miss. Calculation and playback lock all gameplay controls.

Each explosion scores `round(maxScore × max(0, 1 - d/radius))`, where `d` is distance to the nearest point on the tank hull. Add opponent contribution and subtract self contribution from the shooter only. Exact radius edge gives zero. No direct-hit bonus or terrain shielding. Tanks settle after all explosions; no fall damage or elimination.

Disconnect holds a seat for 20 seconds while deadlines continue. If only one player remains absent, they forfeit after the grace period; both absent produces an abort with no winner. An accepted shot finishes before a pending terminal result. A refresh can recover with the transport reconnection token. Explicit leave forfeits immediately at a safe phase boundary. Finished results never change.
