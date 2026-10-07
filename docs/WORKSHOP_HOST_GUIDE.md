# Host guide

Deploy and verify the shared backend before participant time begins. Freeze a tested release. Give attendees the backend reference ZIP, verified HTTPS origin and a partner. They create their own frontend from scratch, including its game-specific connection/playback logic. Provide no Artillery client SDK, starter frontend or local backend. Neon and Paper are host demos, not templates to distribute.

Run `npm run package:reference` to produce `dist/downloads/artillery-lab-backend-reference.zip`. It contains the participant brief/prompt, connection guide, protocol/rules/terrain/weapon documentation, generated backend data shapes and labeled JSON recordings. Share only that archive, not the host repository. After rebuilding/deploying the web image, the landing page links `/downloads/artillery-lab-backend-reference.zip`.

Agree on participant frontend ports (for example localhost:5173) and approve exact localhost/preview origins in advance; restarting to change origins ends active in-memory games. Attendees may use their own frontend framework and package manager, and independently install a compatible Colyseus transport library. They implement all game-specific behavior from the documentation. Only the shared deployed backend runs during the workshop; host-local servers are for pre-workshop development/testing.

Suggested 45-minute schedule: 5-minute cross-theme demo and protocol introduction; 5-minute frontend setup; 20-minute connection/gameplay build; 10-minute partner playtest and design; 5-minute showcase. Creating networking/playback from scratch is more work than reskinning a starter: rehearse this flow with an empty frontend project and the reference pack, and adjust the time based on that result. Prioritize a complete quick match before polish. Standard mode demonstrates Borer in longer sessions.

Demonstrate Neon creating a room and Paper joining its code. Explain scores rather than health, self-hit penalties, finite inventory, shared wind, timeout auto-fire and limited moves. Refresh one tab during a shot and show the same final crater/checksum. Practice is clearly marked; the simple bot uses bounded legal angle/power choices with random error, without an LLM or API key.

Eligibility: finish a real cross-frontend match and agree on final authoritative values/checksums. Judging: integration/reliability 30%, controls/readability 25%, visual identity 20%, animation/audio feedback 15%, accessibility/edge cases 10%. Gameplay winner and frontend winner are separate awards.

Fairness restriction is a workshop rule, not cryptographic anti-cheat. Public terrain and physics can be reverse-engineered. Server authority rejects forged outcomes but cannot prove a custom frontend lacks an aim solver. Review submissions for automated targeting and full trajectory assistance when enforcing the human-control challenge.

Rehearse production images, DNS/TLS, two sample clients, an independently built participant frontend connected to the deployed backend, mid-shot refresh, venue RTT, separate-machine load, log ingestion, rollback and reboot. A retired starter test does not establish that the new from-scratch workshop fits its time budget. Never run the generator on the game VM when claiming VM capacity. Mumbai vs Delhi needs actual venue testing; geography alone cannot guarantee 20–60 ms RTT.

No automated deployments during active matches. Drain first. A single VM is a deliberate failure point: after a restart, create new rooms. Keep the previous image pair and a rollback operator ready. If the deployed backend is unavailable, attendees can continue visual work using labeled recordings, but live acceptance remains blocked; do not ask attendees to start a local backend.
