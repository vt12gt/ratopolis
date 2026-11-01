/**
 * Ratopolis Server Module
 * In-memory authoritative room registry. Production Durable Object scheduling,
 * auth and transport are deliberately integrated in a later step.
 */
const PHASES = new Set(["waiting", "shaman_selection", "running", "finished"]);
const clone = value => structuredClone(value);

export class RatopolisServer {
  constructor({ clock = () => Date.now(), maxPlayers = 50, snapshotHistory = 64 } = {}) {
    if (typeof clock !== "function") throw new Error("clock_invalid");
    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 200) throw new Error("max_players_invalid");
    if (!Number.isInteger(snapshotHistory) || snapshotHistory < 1 || snapshotHistory > 512) throw new Error("snapshot_history_invalid");
    this.clock = clock;
    this.maxPlayers = maxPlayers;
    this.snapshotHistory = snapshotHistory;
    this.rooms = new Map();
  }

  createRoom({ roomId, mapId, metadata = {} } = {}) {
    const id = typeof roomId === "string" ? roomId.trim() : "";
    const map = typeof mapId === "string" ? mapId.trim() : "";
    if (!id || id.length > 100) throw new Error("room_id_invalid");
    if (!map || map.length > 100) throw new Error("map_id_invalid");
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("room_metadata_invalid");
    if (this.rooms.has(id)) throw new Error("room_already_exists");
    const room = {
      id, mapId: map, metadata: clone(metadata), phase: "waiting", phaseNumber: 0,
      createdAt: this.clock(), players: new Map(), sequence: 0, history: [], state: null
    };
    this.rooms.set(id, room);
    return this.describeRoom(room);
  }

  removeRoom(roomId) { return this.rooms.delete(String(roomId)); }

  addAuthenticatedPlayer(roomId, identity) {
    const room = this.requireRoom(roomId);
    const userId = typeof identity?.userId === "string" ? identity.userId.trim() : "";
    const nickname = typeof identity?.nickname === "string" ? identity.nickname.trim() : "";
    if (!userId || userId.length > 128 || !nickname || nickname.length > 24 ||
        /[\u0000-\u001f\u007f]/.test(nickname)) throw new Error("verified_identity_required");
    if (room.players.has(userId)) return this.publicPlayer(room.players.get(userId));
    if (room.players.size >= this.maxPlayers) throw new Error("room_full");
    const player = { userId, nickname, joinedAt: this.clock(), connected: true };
    room.players.set(userId, player);
    this.record(room, "player_joined", { userId, nickname });
    return this.publicPlayer(player);
  }

  removePlayer(roomId, userId) {
    const room = this.requireRoom(roomId);
    const id = String(userId);
    if (!room.players.delete(id)) return false;
    this.record(room, "player_left", { userId: id });
    return true;
  }

  setPhase(roomId, phase) {
    if (!PHASES.has(phase)) throw new Error("phase_invalid");
    const room = this.requireRoom(roomId);
    if (room.phase === phase) return this.snapshot(roomId);
    room.phase = phase;
    room.phaseNumber += 1;
    this.record(room, "phase_changed", { phase, phaseNumber: room.phaseNumber });
    return this.snapshot(roomId);
  }

  publishState(roomId, authoritativeState) {
    const room = this.requireRoom(roomId);
    if (!authoritativeState || typeof authoritativeState !== "object" || Array.isArray(authoritativeState)) {
      throw new Error("authoritative_state_invalid");
    }
    room.state = clone(authoritativeState);
    this.record(room, "state_updated", {
      tick: Number.isSafeInteger(authoritativeState.tick) ? authoritativeState.tick : 0
    });
    return this.snapshot(roomId);
  }

  snapshot(roomId) {
    const room = this.requireRoom(roomId);
    return clone({
      roomId: room.id, mapId: room.mapId, phase: room.phase,
      phaseNumber: room.phaseNumber, sequence: room.sequence,
      players: [...room.players.values()].map(p => this.publicPlayer(p)),
      state: room.state, events: room.history.slice(-this.snapshotHistory)
    });
  }

  listRooms() { return [...this.rooms.values()].map(room => this.describeRoom(room)); }
  requireRoom(roomId) {
    const room = this.rooms.get(String(roomId));
    if (!room) throw new Error("room_not_found");
    return room;
  }
  record(room, type, payload) {
    room.history.push({ sequence: ++room.sequence, type, payload: clone(payload), at: this.clock() });
    if (room.history.length > this.snapshotHistory) room.history.shift();
  }
  publicPlayer(player) {
    return { userId: player.userId, nickname: player.nickname, connected: player.connected };
  }
  describeRoom(room) {
    return {
      roomId: room.id, mapId: room.mapId, phase: room.phase,
      playerCount: room.players.size, maxPlayers: this.maxPlayers, createdAt: room.createdAt
    };
  }
}
