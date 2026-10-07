# Local test report

Handoff: 8 October 2026. The playable backend, internal host-demo client, two themes and deployment tooling are implemented. The attendee handoff now contains backend documentation and data only; attendees build from scratch and connect to the deployed backend. Public cloud deployment and the full workshop-capacity rehearsal are not completed.

## Verified

- Updated handoff verification: `npm run lint`, `npm run build` and `npm run package:reference` passed. The new ZIP contains 22 Markdown/JSON files, with no executable assets or SDK. All internal Markdown links resolve and all 13 example terrain checksums validate. The built landing page links the reference ZIP; the old starter archive was moved outside `dist/downloads` and preserved under its reference build staging directory.
- Default dev/build now includes only the backend and two host demos. Production image packaging copies only the named reference ZIP. These changes have not been deployed; existing running images require a rebuild/redeployment to expose the new handoff.
- TypeScript and client/server authority-boundary checks passed.
- 26 unit/integration tests passed, covering terrain, physics, both match lengths, command validation, real Colyseus connections/reconnection, Origin rejection, worker failure and bounded admission.
- Local production-proxy browser suite: three tests passed. Neon and Paper completed a shared quick match, refreshed during flight, compared terrain/tanks/players, and rematched. Standard-mode recovery was tested after a cluster split and during drilling. Lobby layouts were checked at 1024×768, 1280×720 and 1920×1080.
- Four injected TCP-delay profiles (approximately 20, 60, 150 and 300 ms RTT, with jitter bursts) passed convergence checks. See `test-results/network-report.json`.
- A 50-room local load run completed 1,448 shots after warm-up with zero errors. Total elapsed time was 139.445 seconds, including warm-up and draining. Shot-calculation p50/p95/p99 were 5.81/10.35/12.84 ms over the retained samples; queue p95 was 5.93 ms. Final server RSS was approximately 299 MiB. See `test-results/load-report.json`.
- Historical evidence for the superseded starter: its packaging task built/typechecked the isolated app, and an earlier ZIP installed/built outside the repository. That starter and SDK are no longer distributed; this does not validate the current from-scratch participant workflow.
- Local Docker images built and ran through the Caddy proxy. Public pages, health/readiness, version metadata and the ZIP returned HTTP 200.

Measurements used Node 22.20.0, Bun 1.4.2 and an i9-13900HX Linux host with 32 logical CPUs and approximately 15.3 GiB RAM. The load generator ran on the same host. These are not cloud capacity or venue latency measurements. Browser screenshots are in `test-results/`.

## Not verified / remaining acceptance

- The current documentation-only attendee workflow needs a rehearsal with a frontend created independently from the reference pack against the deployed backend. The retired starter's conditional E2E test was removed because it no longer represents the workshop.
- The final proxy check observed HTTP 403 for an internal path: access was denied, but the expected proxy-level response was 404. Caddy routing was corrected to use an exclusive private-path handler; the final rebuild/recheck was interrupted and is not claimed as verified.
- No Google Cloud resources, registry release digests, public DNS, HTTPS/WSS deployment, cloud reboot/rollback drill or billed resources were created. Scripts/configuration exist but require operator inputs and live validation.
- The required 15-minute, 50-room run on the selected VM with an external generator, CPU/RSS trend capture and venue-network tests remains outstanding.
- Full tab suspension, packet loss, sustained slow rendering and comprehensive accessibility/device profiling remain rehearsal items. The delay harness preserves TCP reliability and does not simulate packet loss.
- Terrain rendering caches a full mask layer per revision; dirty-region texture optimization is not implemented. FPS statistics are sampling estimates, not a hardware performance certification.

Run commands and deployment prerequisites are in the root README and `deploy/gcloud/README.md`. There is no Git repository in this workspace, so no commit was created.
