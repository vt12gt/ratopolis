# Ratopolis v1.57.0 - Modular Server

The browser sends input intent and renders snapshots. It must not decide player positions, collisions, Shaman identity, physics, phase results, XP, currency or rewards.

## Modules
- src/server/physics/physics-engine.js: fixed-step 60 Hz gravity, acceleration, friction, jumps, world bounds, AABB collision and spring/trampoline impulses.
- src/server/room/room-simulation.js: room lifecycle, participants, phase state, commands and authoritative snapshots.
- src/server/shaman/shaman-authority.js: 15-second election, mana, build limits and object ownership.
- src/shared/resources/maps.js: versioned map resources and colliders.
- src/shared/protocol/commands.js: command allow-list; no client-authoritative positions.
- src/client/network/authoritative-room-client.js: WebSocket adapter for input intent and snapshots.
- tests/physics/physics-engine.test.js: initial automated tests.

## Production integration
This is an isolated implementation candidate. It does not replace the active room Worker. Integrate RoomSimulation inside the existing authenticated Cloudflare Durable Object. Preserve session validation and derive account ID and nickname from the verified session, never from client payload.

The Durable Object must create one simulation per room, accept only allowed commands, run server-controlled 60 Hz ticks, broadcast sequenced snapshots, handle reconnects idempotently and preserve existing matchmaking, room limits and account rules.

Do not replace the portal, D1 identity, login or production Worker in this change. Do not use Adobe Flash; Client means HTML5/JavaScript/Canvas. Run npm run test:physics before staging. Load, latency, reconnect, anti-cheat and real-device tests are still required.
