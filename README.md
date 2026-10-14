# Artillery Lab

A turn-based artillery game with two playable browser themes: **Neon Siege** and **Paper Battalion**. Both connect to the same authoritative game server and can play against each other.

Artillery Lab was built for a frontend workshop. This repository includes the complete game so you can play, host matches with friends, and build your own ideas on top. Local play runs on your computer without cloud services or player accounts. See [release readiness](docs/PUBLIC_RELEASE.md) for the remaining publication checks.

## Play on your computer

Install Node.js 22.20+ (supported versions: 22–24) and Bun 1.4.2, then open a terminal in this repository:

```sh
bun install --frozen-lockfile
npm run dev
```

Keep that terminal running and open either theme:

- Neon Siege: http://localhost:5173/neon/
- Paper Battalion: http://localhost:5174/paper/

Choose Practice to play against a server bot. For two players, open two browser tabs, create a room in one, and join its six-character code in the other. Press Ready in both tabs. The themes are compatible; each player can choose either one. Aim, set power, and fire on your turn. In a quick match each player fires five shots; hits earn points and self-hits lose points. Both players must request a rematch.

Stop with Ctrl+C. Rooms and matches live in memory and are lost when the server restarts. This is a networked game even in practice mode: keep the local backend running.

## Run with Docker

With Docker Engine/Desktop and Docker Compose v2 installed, no local Node or Bun installation is needed:

```sh
docker compose -f deploy/compose.local.yaml up --build -d
```

Open http://localhost:8080/neon/ or http://localhost:8080/paper/. The first build installs dependencies and runs backend checks, so it can take several minutes.

```sh
docker compose -f deploy/compose.local.yaml logs -f
docker compose -f deploy/compose.local.yaml down
```

The default Docker setup is accessible only from your computer. For friends on a network or an independently hosted internet server, follow [self-hosting](docs/SELF_HOSTING.md).

## Develop and verify

Bun manages dependencies; Node runs the server and physics workers. Keep `bun.lock` as the dependency source; do not replace it with an npm lockfile. The root package is private to prevent accidental registry publication; this does not control repository visibility.

```sh
npm run lint
npm test
npm run build
npm run test:e2e       # npm run dev must be running in another terminal
npm run test:network   # npm run dev must be running in another terminal
```

Browser checks require Chromium (`npx playwright install chromium`; Linux may also need Playwright system dependencies). Build output goes to ignored `dist/`. `npm start` runs the built backend only; it does not serve the browser clients. Use the dev command or Docker for a complete playable installation.

Read [game rules](docs/GAME_RULES.md), [architecture](docs/ARCHITECTURE.md), and [the internal client API](docs/SDK_REFERENCE.md). The retired `apps/participant-starter` is excluded from default development and builds. Both complete game clients and their shared implementation are included in this repository.

## Workshop reference

The game originated as a frontend workshop. [Backend connection documentation](docs/BACKEND_CONNECTION.md), [participant brief](docs/PARTICIPANT_BRIEF.md), and [host guide](docs/WORKSHOP_HOST_GUIDE.md) describe that workflow. Their references to host-only code and a provided public backend describe the original workshop distribution, not a requirement for running this repository.

`npm run package:reference` creates a documentation/data ZIP for that workshop. It is not a playable game distribution; clone the full repository to run the game.

## Support and reuse

Play it, host it, fork it, or use it as a starting point for your own game. Artillery Lab is licensed under the [Apache License 2.0](LICENSE). Third-party dependencies and materials retain their respective licenses. See [SUPPORT](SUPPORT.md) for community help and hosting expectations.
