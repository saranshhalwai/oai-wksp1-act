# Participant prompt

Build an original Artillery Lab frontend from scratch in this project. The host provides a deployed backend and the attached backend reference pack. Read README.md, BACKEND_CONNECTION.md, PROTOCOL.md, BACKEND_TYPES.md, GAME_RULES.md and PHYSICS_AND_TERRAIN.md first.

Host backend origin: REPLACE_WITH_HOST_HTTPS_ORIGIN
My frontend origin: REPLACE_WITH_HOST_APPROVED_FRONTEND_ORIGIN

Create the frontend project and choose suitable browser tooling. Run only the frontend locally. Connect to the specified deployed backend; do not build, start or deploy a local backend, mock service or replacement physics engine. If the URL is missing or the backend/origin is unavailable, report that specific blocker while continuing UI work with the labeled example data. Do not silently fall back to localhost or fake a successful connection.

No Artillery client SDK or starter frontend is supplied. Implement game-specific networking, state handling, command acknowledgments, timeline playback, terrain decoding/patches and reconnection yourself using the documented protocol. You may install the ordinary Colyseus transport dependency identified in BACKEND_CONNECTION.md; do not import @artillery/client-sdk, copy a host demo or assume a createArtilleryClient API exists.

Start by connecting, creating/joining a room and rendering the server's terrain and tanks. Add ready, integer angle/power controls, weapon selection, fire, movement, score/history, turn timer and results/rematch. Use real accepted server events for animation. Preserve match/turn IDs, command deduplication, checksums and seat identity. Keep controls disabled when they are illegal and show useful connection/acknowledgment errors.

Create a distinctive visual identity with original assets, layout, typography, effects and sound. Keep the full 1024×576 world uniformly scaled, the real collision mask visible and tank hull/pivot/muzzle geometry exact. Implement the documented short direction guide only; no full trajectory, predicted impact, recommended aim or automated targeting. Sound requires a gesture and mute controls; support reduced motion and keyboard operation.

Run your project's checks and inspect it at 1024×768 and 1280×720. Complete a live match against another attendee or a host demo using the deployed backend. Verify scores, ammo, tank positions and terrain checksum; refresh during flight and verify recovery. Report actual test results and remaining problems honestly. Offline recordings must remain visibly labeled examples.
