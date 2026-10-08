# Acceptance checklist

## Implemented and locally checked

- [x] Authoritative rooms, score-based play, quick/standard inventory, deadlines, movement, rematch and practice bot.
- [x] Seeded occupancy terrain, swept deterministic physics, five weapon types, scoring and settling.
- [x] Bounded worker pool, command acknowledgments/deduplication, terrain checksums, snapshots and reconnect recovery.
- [x] Internal shared client for host demos; no attendee SDK distribution.
- [x] Distinct Neon Siege and Paper Battalion presentations and a complete cross-theme browser match.
- [x] Documentation/data-only backend reference pack and from-scratch participant instructions.
- [x] Unit/integration tests, browser checks, delay tests and a short 50-room local load run.
- [x] Docker, Caddy, CI, Google Cloud operator scripts and workshop documentation.
- [x] Windows reference ZIP packaging, 29 unit/integration tests and five browser tests; user verified bot play.
- [x] Nonblocking waiting room with per-seat readiness, cancel-ready, visible exit, disband notification and old-code recovery.

## Outstanding gates

- [ ] User repeat playtest of the updated waiting-room flow (local servers available).
- [ ] Container validation on this Windows host (Docker is not installed).

- [ ] Recheck the final Caddy private-route 404 fix after rebuilding.
- [ ] Rehearse an independently built attendee frontend using only the reference pack against the deployed backend, including a complete match and reconnect.
- [ ] Supply an authorized Google Cloud project, billing/IAM and owned domain; deploy and verify HTTPS/WSS.
- [ ] Record real registry digests, release metadata, monitoring and reboot/drain/rollback evidence.
- [ ] Run the 15-minute target-VM load rehearsal and venue/device tests.

See TEST_REPORT.md for actual measurements and limitations. Local implementation is available now; this checklist does not certify a production workshop deployment.
