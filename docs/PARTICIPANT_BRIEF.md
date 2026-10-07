# Build your own Artillery Lab frontend

Start with an empty frontend project and build an original playable interface using the deployed backend. The host supplies the backend URL, documentation and recorded example data. No game client SDK, frontend template or local backend is supplied.

Your work includes the UI, battlefield renderer, connection handling, commands, server-event playback and recovery. The server owns rooms, rules, physics, terrain, scores and results. Neon Siege and Paper Battalion are host demos you can play against; they are not participant starting templates.

## Before you build

1. Get the live HTTPS backend origin from the host. A configured domain is not proof that deployment is ready.
2. Read [BACKEND_CONNECTION.md](BACKEND_CONNECTION.md), [PROTOCOL.md](PROTOCOL.md) and [GAME_RULES.md](GAME_RULES.md). The reference ZIP also includes BACKEND_TYPES.md and examples/ JSON recordings.
3. Create your own frontend project with your preferred tools. npm or Bun is fine. Only your frontend runs locally; do not install, start or deploy a game backend.
4. Tell the host your exact frontend origin, for example `http://localhost:5173`, so it can be allowed by the server. Ports matter. Keep the configured port fixed instead of silently falling back to another.
5. Set the host's HTTPS origin in your frontend's public configuration. Do not use a localhost backend URL or fall back to a local server. No cloud credentials or AI API keys are needed by the game.

## Build and play

First connect, create/join a room, identify your seat and draw the received terrain/tanks. Then implement ready, angle/power/weapon controls, fire, server playback and score updates. Add movement, reconnect, results and rematch. Finish with your visual design, sound and accessibility.

The backend uses Colyseus 0.18 transport. Its framing is not plain JSON WebSocket traffic. You can independently install a compatible general-purpose Colyseus transport library as described in the connection guide; no Artillery client implementation or dependency package is provided. You implement the game-specific client logic yourself.

Quick mode gives each player five shots and a 20-second turn deadline. Points score against the other tank; self-hits subtract points. Tanks do not have health. Render the canonical mask and tank geometry. Aim assistance is limited to a fixed-length barrel direction guide; no full trajectory, landing marker or automatic targeting.

Complete a real match against another attendee or a host demo. Both clients must agree on scores, inventory, tank positions and terrain checksum. Refresh during a shot and recover the same match. Recorded examples help visual development but are not a substitute for live integration.

The reference pack is documentation and data, so there is no install command or dev server for the pack itself. Use [PARTICIPANT_CODEX_PROMPT.md](PARTICIPANT_CODEX_PROMPT.md) with your own project and the host's actual backend URL.
