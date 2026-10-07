# Implementation progress

- Specification read in full. Empty source workspace; Node 22.20.0 and Docker CLI available.
- Verified npm metadata: Colyseus core 0.18.18, SDK 0.18.5, transport 0.18.4, schema 5.0.36. Core requires Node 22 or later.
- Implemented terrain, deterministic simulation, authoritative rooms, internal host-demo client, both themes and Google Cloud deployment tooling.
- Updated workshop scope: attendees receive backend documentation/data and the deployed URL, then build their own frontend and connection logic from scratch. No SDK, frontend starter or local backend is distributed. The retired starter remains internal only.
- Reference handoff built and checked: 22 documentation/data files, all links resolved, all 13 recorded terrain checksums verified. Typecheck/lint and both demo builds passed. Updated public download requires deployment of the new web image.
- Local unit/integration, cross-theme browser, latency and short 50-room load tests passed; detailed evidence and remaining gates are in TEST_REPORT.md and ACCEPTANCE_CHECKLIST.md.
- The private-proxy recheck remains pending. Current attendee acceptance requires an independent frontend rehearsal on the deployed backend.
- Public deployment is pending an authorized billing-enabled project and DNS/domain inputs. No cloud resources created.
- User approved alternatives to pnpm and noted installed Bun 1.4.2. Use Bun workspaces and frozen bun.lock installs; Node remains the application runtime. npm run commands also work.
