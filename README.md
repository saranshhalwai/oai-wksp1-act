# Artillery Lab

An original, score-based artillery game for a frontend workshop. The host deploys one authoritative Colyseus backend and provides its URL, backend documentation and example data. Attendees build their own frontend and game connection logic from scratch. They run only their frontend locally and connect to the deployed backend. No client SDK or starter frontend is distributed.

Neon Siege and Paper Battalion are host demos. Their shared client implementation stays internal to this host repository. The original prompt's SDK/starter handoff is superseded by this workshop model.

## Host development only

Requires Node 22.20+ (22 LTS recommended) and Bun 1.4.2. Bun manages packages; **Node runs the server and workers**. The user approved replacing the prompt's pnpm requirement with an available package manager.

```bash
bun install --frozen-lockfile
npm run dev
```

- Neon: http://localhost:5173/neon/
- Paper: http://localhost:5174/paper/
- Backend: http://localhost:2567/healthz

Open Neon in one tab and Paper in another. Create a room, copy its six-character code, join from the other theme, and press Ready in both. Each player fires five times; hits add points and self-hits subtract points. Both players must request a rematch. Practice uses a clearly marked server bot.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e                 # local servers must be running
npm run test:network             # local servers must be running
ROOMS=50 DURATION_SECONDS=900 npm run test:load
npm run package:reference        # build documentation/data ZIP; no app build needed
```

`bun run <script>` also works. Do not use `npm install` to update this host workspace: `bun.lock` is its reproducibility source. Attendees choose npm or Bun for their own projects.

## Attendee handoff

Give attendees `dist/downloads/artillery-lab-backend-reference.zip` and the verified public backend URL. The ZIP contains Markdown documentation, protocol data shapes and labeled JSON recordings. It contains no SDK, dependencies, frontend source, viewer or runnable backend. There is nothing to install or start in the reference pack itself.

Attendees implement their own connection, commands, rendering, timeline playback and recovery. Ordinary framework dependencies may be installed independently; the backend uses Colyseus framing, not plain JSON WebSockets. Start with [BACKEND_CONNECTION](docs/BACKEND_CONNECTION.md) and [PARTICIPANT_BRIEF](docs/PARTICIPANT_BRIEF.md). Agree on frontend ports and allow their exact origins before the workshop. Local backend commands above are solely for host development and tests.

The older `apps/participant-starter` remains as a retired internal prototype; it is excluded from default dev/build and from all attendee packaging. The package task preserves any previously generated starter ZIP outside the public downloads directory.

## Production and workshop

```bash
docker compose -f deploy/compose.local.yaml up --build -d
# Local production proxy: http://localhost:8080/neon/ and /paper/
docker compose -f deploy/compose.local.yaml down
```

The public target is one Google Compute Engine VM and Caddy HTTPS/WSS. No cloud resources are created by building this project. Start with [the exact operator runbook](deploy/gcloud/README.md), then consult [deployment](docs/DEPLOYMENT_GCLOUD.md), [operations](docs/GCLOUD_OPERATIONS.md) and [cost/cleanup](docs/COST_AND_CLEANUP.md). Public deployment requires an authorized billing-enabled project, operator IAM and an owned DNS name.

Actual checks and limitations are recorded in [TEST_REPORT](docs/TEST_REPORT.md) and [ACCEPTANCE_CHECKLIST](docs/ACCEPTANCE_CHECKLIST.md). The full workshop capacity target is not established by a local smoke/load run.

Read [GAME_RULES](docs/GAME_RULES.md), [ARCHITECTURE](docs/ARCHITECTURE.md), [BACKEND_CONNECTION](docs/BACKEND_CONNECTION.md), [PARTICIPANT_BRIEF](docs/PARTICIPANT_BRIEF.md) and [WORKSHOP_HOST_GUIDE](docs/WORKSHOP_HOST_GUIDE.md). [SDK_REFERENCE](docs/SDK_REFERENCE.md) documents host-demo internals only.
