/**
 * Ratopolis Resource Module
 * Versioned resource registry. Official map geometry is imported only after
 * locating the actual v1.55.11 map source; this module never fabricates it.
 */
const deepFreeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const SHAMAN_OBJECTS = deepFreeze({
  plank: { width: 120, height: 18, mass: 1, friction: 0.72 },
  bridge: { width: 180, height: 20, mass: 1.2, friction: 0.72 },
  box: { width: 48, height: 48, mass: 2, friction: 0.78 },
  anvil: { width: 54, height: 54, mass: 5, friction: 0.8 },
  spring: { width: 58, height: 22, mass: 1, friction: 0.65, bounce: 900 },
  trampoline: { width: 100, height: 24, mass: 2, friction: 0.65, bounce: 900 },
  pillar: { width: 28, height: 120, mass: 3, friction: 0.78 }
});

export class ResourceRegistry {
  constructor() { this.maps = new Map(); this.assets = new Map(); }

  registerMap(map) {
    validateMap(map);
    if (this.maps.has(map.id)) throw new Error("map_already_registered");
    this.maps.set(map.id, structuredClone(map));
    return this.getMap(map.id);
  }
  registerAsset(asset) {
    if (!asset || typeof asset.id !== "string" || !asset.id.trim() || asset.id.length > 128) {
      throw new Error("asset_id_invalid");
    }
    if (this.assets.has(asset.id)) throw new Error("asset_already_registered");
    this.assets.set(asset.id, structuredClone(asset));
    return this.getAsset(asset.id);
  }
  getMap(id) {
    const value = this.maps.get(String(id));
    if (!value) throw new Error("map_not_found");
    return structuredClone(value);
  }
  getAsset(id) {
    const value = this.assets.get(String(id));
    if (!value) throw new Error("asset_not_found");
    return structuredClone(value);
  }
  listMaps() {
    return [...this.maps.values()].map(({ id, version, width, height }) => ({ id, version, width, height }));
  }
}

export function validateMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map) ||
      typeof map.id !== "string" || !map.id.trim() || map.id.length > 100 ||
      !Number.isInteger(map.version) || map.version < 1 ||
      !Number.isFinite(map.width) || map.width <= 0 ||
      !Number.isFinite(map.height) || map.height <= 0 ||
      !Array.isArray(map.colliders) || map.colliders.length > 5000) {
    throw new Error("map_schema_invalid");
  }
  const seen = new Set();
  for (const collider of map.colliders) {
    if (!collider || typeof collider.id !== "string" || !collider.id.trim() ||
        collider.id.length > 100 || seen.has(collider.id) ||
        !["x", "y", "w", "h"].every(k => Number.isFinite(collider[k])) ||
        collider.w <= 0 || collider.h <= 0) throw new Error("map_collider_invalid");
    seen.add(collider.id);
  }
  return true;
}
