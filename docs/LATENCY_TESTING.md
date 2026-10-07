# Latency and capacity measurements

Start the backend, then `npm run test:network`. The TCP forwarding harness adds 10/30/75/150 ms in each direction for approximately 20/60/150/300 ms RTT, plus 40 ms bursts every seventeenth chunk. It preserves TCP order and reliability. Report injected delay separately from actual ping RTT; this is not packet loss or a one-way latency measurement. Results: `test-results/network-report.json`.

The browser suite uses separate contexts for Neon/Paper, refreshes during playback and compares authoritative boundaries. Delayed users may start an animation late; SDK seeking applies missed edits and suppresses old sounds. Local aim does not wait for the server, while Fire shows pending until acknowledgment. A slow renderer cannot delay authoritative commits. Full tab suspension/slow-device profiling remains a separate rehearsal task unless recorded in TEST_REPORT.

Full target command, on a **separate client machine**:

```bash
BACKEND_URL=https://YOUR_GAME_DOMAIN ROOMS=50 WARMUP_SECONDS=20 DURATION_SECONDS=900 npm run test:load
```

The harness creates paired clients, uses legal aim/fire activity and cluster/borer bursts, turns over completed standard matches and checks every terrain commit. Output includes host/runtime, duration, room count, throughput, ack/RTT quantiles, bytes and errors. Private worker metrics can be captured via the IAP status command; they are deliberately unavailable through the public proxy. Local load measurements include same-host contention and do not establish deployed capacity, browser FPS or venue RTT.

Collect calculation p50/p95/p99 separately from queue wait, process RSS trend, host CPU/memory/disk, event-loop delay, errors and bandwidth. Target p95 calculation <100 ms; queue and network latency are additional. Record project, region, zone, machine type, worker count, both image digests, release and generator location. Reduce MAX_ROOMS or increase VM capacity based on measured evidence.
