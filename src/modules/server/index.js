/** Server module: authoritative simulation and Durable Object adapter. */
import { RoomSimulation } from "../../server/room/room-simulation.js";
export { PhysicsEngine, PHYSICS } from "../../server/physics/physics-engine.js";
export { RoomSimulation } from "../../server/room/room-simulation.js";
export { RoomWorkerAdapter } from "../../server/room/room-worker-adapter.js";
export { ShamanAuthority, SHAMAN_OBJECTS } from "../../server/shaman/shaman-authority.js";

export function createRoomServer(options = {}) {
  return new RoomSimulation(options);
}
