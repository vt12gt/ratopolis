/** Resource module: versioned map/resource access. */
import { getMap, listMaps } from "../../shared/resources/maps.js";
export { getMap, listMaps };

export function loadMapResource(mapId, expectedVersion = undefined) {
  const map = getMap(mapId);
  if (expectedVersion !== undefined && Number(expectedVersion) !== map.version) {
    throw new Error("map_version_mismatch");
  }
  if (!Number.isFinite(map.width) || !Number.isFinite(map.height) ||
      !Array.isArray(map.colliders)) throw new Error("invalid_map_resource");
  const ids = new Set();
  for (const c of map.colliders) {
    if (!c.id || ids.has(c.id) ||
        ![c.x, c.y, c.w, c.h].every(Number.isFinite) || c.w <= 0 || c.h <= 0) {
      throw new Error("invalid_map_collider");
    }
    ids.add(c.id);
  }
  return map;
}
