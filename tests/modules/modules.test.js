import test from "node:test";
import assert from "node:assert/strict";
import { RatopolisServer } from "../../modules/server/index.js";
import { decodeRequest, encodeMessage } from "../../modules/request/index.js";
import { ResourceRegistry } from "../../modules/resource/index.js";
import { RatopolisClient } from "../../modules/client/index.js";

test("Server only accepts verified identity and publishes room snapshots", () => {
  const server = new RatopolisServer({ clock: () => 1000 });
  server.createRoom({ roomId: "room-a", mapId: "map-a" });
  assert.throws(() => server.addAuthenticatedPlayer("room-a", { userId: "u1" }), /verified_identity_required/);
  server.addAuthenticatedPlayer("room-a", { userId: "u1", nickname: "Rato 1" });
  const snapshot = server.snapshot("room-a");
  assert.equal(snapshot.players[0].userId, "u1");
  assert.equal(snapshot.players[0].nickname, "Rato 1");
});

test("Request decodes versioned valid messages and rejects malformed payloads", () => {
  const valid = encodeMessage("input", { input: { left: true, right: false, jump: true } }, "req-1");
  assert.equal(decodeRequest(valid).ok, true);
  assert.equal(decodeRequest(JSON.stringify({ version: 1, type: "input", input: { left: "yes" } })).error, "invalid_payload");
  assert.equal(decodeRequest(JSON.stringify({ version: 9, type: "ping" })).error, "protocol_version_unsupported");
});

test("Resource registry validates maps and returns defensive copies", () => {
  const registry = new ResourceRegistry();
  registry.registerMap({ id: "map-a", version: 1, width: 800, height: 600, colliders: [
    { id: "floor", x: 0, y: 550, w: 800, h: 50 }
  ] });
  const map = registry.getMap("map-a");
  map.colliders[0].x = 999;
  assert.equal(registry.getMap("map-a").colliders[0].x, 0);
  assert.throws(() => registry.registerMap({ id: "bad", version: 1, width: 0, height: 10, colliders: [] }), /map_schema_invalid/);
});

test("Client forwards input and renders server snapshots without owning state", async () => {
  class FakeTransport extends EventTarget {
    async connect() { this.dispatchEvent(new Event("connected")); }
    input(value) { this.lastInput = value; return true; }
    close() {}
  }
  const transport = new FakeTransport();
  let rendered = null;
  const client = new RatopolisClient({ transport, renderer: { renderSnapshot: s => { rendered = s; } } });
  await client.connect();
  client.sendInput({ right: true });
  assert.deepEqual(transport.lastInput, { left: false, right: true, jump: false });
  transport.dispatchEvent(new CustomEvent("state", { detail: { type: "room_snapshot", roomId: "room-a", players: [] } }));
  assert.equal(rendered.roomId, "room-a");
  client.destroy();
});
