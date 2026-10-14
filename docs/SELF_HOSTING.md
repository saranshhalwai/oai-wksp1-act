# Self-hosting Artillery Lab

Start with the root README for local play. The two themes and the backend are all included; you do not need the original team's deployment or workshop reference ZIP.

## Play with friends on a trusted LAN

Use the Docker setup from the README. To expose it on your LAN, create an ignored `deploy/compose.lan.yaml` override:

```yaml
services:
  game:
    environment:
      ALLOWED_ORIGINS: http://192.168.1.20:8080
  web:
    ports: !override
      - "8080:80"
```

Replace `192.168.1.20` with the server computer's LAN IP. The `!override` tag requires Docker Compose 2.24.4 or newer. Start both files:

```sh
docker compose -f deploy/compose.local.yaml -f deploy/compose.lan.yaml up --build -d
```

Players on the same network open `http://192.168.1.20:8080/neon/` or `/paper/`. Allow inbound TCP 8080 in the host firewall for that network. A room code works only for players connected to the same backend. Stop with the same two `-f` arguments and `down`.

This origin setting permits only that exact browser origin; add other origins as comma-separated values if needed. Origins contain a scheme, hostname and optional port, with no path or trailing slash. Do not use a wildcard to work around a connection failure. CORS is not authentication: anyone who can reach the server can attempt to play.

## Host an internet server

Use HTTPS/WSS and a reverse proxy. The included Caddy configuration serves both clients and proxies game traffic on one origin, including WebSocket upgrades. It blocks the backend's internal management endpoints from public access. Keep backend port 2567 private.

The existing [Google Cloud runbook](../deploy/gcloud/README.md) and [Cloudflare Tunnel variant](../deploy/CLOUDFLARE_TUNNEL.md) describe independent hosting choices. They require your own infrastructure, credentials, and any associated payments. The production Compose file expects operator-built images pinned by digest, a release ID, domain, email, and explicit origin allowlist; it is not the local quick start.

Do not expose the Vite development servers as a public production service. An internet deployment needs its own capacity planning and updates; past smoke checks do not establish production capacity.

## Operation and troubleshooting

- Docker logs: `docker compose -f deploy/compose.local.yaml logs --tail=100 game web` (add the LAN override when using it).
- Health: `http://localhost:8080/healthz` should return `{"ok":true}`. `/readyz` returns 503 while draining.
- Blank page or no connection: open the documented `/neon/` or `/paper/` URL, check both containers, and inspect browser network errors. A 403 usually indicates a browser origin missing from `ALLOWED_ORIGINS`.
- Native dev: backend health is at `http://localhost:2567/healthz`; clients use ports 5173 and 5174. Free occupied ports before starting.
- HTTPS frontend: use an HTTPS backend with WebSockets through the same reverse proxy to avoid mixed-content blocking.
- Rooms are transient. Restarting or upgrading loses active games, and there is no saved-game database to restore. Announce restarts to your players.
- Room codes are invitations, not accounts or passwords. Do not use them to protect sensitive information.

For native server tuning, see `apps/server/src/index.ts`: `MAX_ROOMS` defaults to 50, `PHYSICS_WORKERS` to 1, and `WORKER_QUEUE_LIMIT` to 32. These are limits, not verified capacity guarantees. Use the operations and load-testing documentation before increasing them.
