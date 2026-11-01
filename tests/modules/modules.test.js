import test from "node:test";
import assert from "node:assert/strict";
import { RatopolisServer } from "../../modules/server/index.js";
import { decodeRequest, encodeMessage } from "../../modules/request/index.js";
import { ResourceRegistry, SHAMAN_OBJECTS } from "../../modules/resource/index.js";
import { RatopolisClient } from "../../modules/client/index.js";

test("Server only accepts verified identity and publishes defensive room snapshots", () => {
  const server = new RatopolisServer({ clock: () => 1000, maxPlayers: 1 });
  server.createRoom({ roomId: "room-a", mapId: "map-a" });
  assert.throws(() => server.addAuthenticatedPlayer("room-a", { userId: "u1" }), /verified_identity_required/);
  server.addAuthenticatedPlayer("room-a", { userId: "u1", nickname: "Rato 1" });
  assert.throws(() => server.addAuthenticatedPlayer("room-a", { userId: "u2", nickname: "Rato 2" }), /room_full/);
  const snapshot = server.snapshot("room-a");
  snapshot.players[0].nickname = "forjado";
  assert.equal(server.snapshot("room-a").players[0].nickname, "Rato 1");
  assert.equal(server.snapshot("room-a").sequence, 1);
  assert.throws(() => new RatopolisServer({ maxPlayers: 0 }), /max_players_invalid/);
});

test("Request decodes versioned valid messages and rejects malformed or oversized messages", () => {
  const valid = encodeMessage("input", { input: { left: true, right: false, jump: true } }, "req-1");
  assert.equal(decodeRequest(valid).ok, true);
  assert.equal(decodeRequest(JSON.stringify({ version: 1, type: "input", input: { left: "yes" } })).error, "invalid_payload");
  assert.equal(decodeRequest(JSON.stringify({ version: 9, type: "ping" })).error, "protocol_version_unsupported");
  assert.equal(decodeRequest(JSON.stringify({ version: 1, type: "input", input: {}, x: 10 })).error, "invalid_payload");
  assert.equal(decodeRequest(JSON.stringify({ version: 1, type: "input", requestId: {}, input: {} })).error, "request_id_invalid");
  assert.equal(decodeRequest(JSON.stringify({ version: 1, type: "ping", clientTime: 1 }), { maxBytes: 5 }).error, "request_size_invalid");
  assert.throws(() => encodeMessage("input", { version: 99, input: {} }), /reserved_envelope_field/);
  assert.throws(() => encodeMessage("set_position", {}), /unknown_command/);
});

test("Resource registry validates maps, returns defensive copies and freezes Shaman specs", () => {
  const registry = new ResourceRegistry();
  registry.registerMap({ id: "map-a", version: 1, width: 800, height: 600, colliders: [
    { id: "floor", x: 0, y: 550, w: 800, h: 50 }
  ] });
  const map = registry.getMap("map-a");
  map.colliders[0].x = 999;
  assert.equal(registry.getMap("map-a").colliders[0].x, 0);
  assert.throws(() => registry.registerMap({ id: "bad", version: 1, width: 0, height: 10, colliders: [] }), /map_schema_invalid/);
  assert.throws(() => registry.registerMap({ id: "dup", version: 1, width: 10, height: 10, colliders: [
    { id: "x", x: 0, y: 0, w: 1, h: 1 }, { id: "x", x: 1, y: 1, w: 1, h: 1 }
  ] }), /map_collider_invalid/);
  assert.equal(Object.isFrozen(SHAMAN_OBJECTS.plank), true);
});

test("Client forwards input only when connected and renders server snapshots", async () => {
  class FakeTransport extends EventTarget {
    async connect() { this.dispatchEvent(new Event("connected")); }
    input(value) { this.lastInput = value; return true; }
    close() {}
  }
  const transport = new FakeTransport();
  let rendered = null;
  const client = new RatopolisClient({ transport, renderer: { renderSnapshot: s => { rendered = s; } } });
  assert.throws(() => client.sendInput({ right: true }), /client_not_connected/);
  await client.connect();
  client.sendInput({ right: true });
  assert.deepEqual(transport.lastInput, { left: false, right: true, jump: false });
  transport.dispatchEvent(new CustomEvent("state", { detail: { type: "room_snapshot", roomId: "room-a", players: [] } }));
  assert.equal(rendered.roomId, "room-a");
  rendered.players.push({ userId: "fake" });
  assert.equal(client.latestSnapshot.players.length, 0);
  client.destroy();
});
