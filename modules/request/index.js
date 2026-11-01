/**
 * Ratopolis Request Module
 * Transport-neutral message contract. WebSocket/Worker wiring is intentionally
 * kept outside this module so it can later attach to the existing Worker safely.
 */
export const PROTOCOL_VERSION = 1;
export const REQUEST_TYPES = Object.freeze([
  "input", "choose_shaman", "place_shaman_object", "remove_shaman_object",
  "connect_shaman_objects", "disconnect_shaman_objects", "request_snapshot", "ping"
]);

const finite = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const id = value => typeof value === "string" && value.length > 0 && value.length <= 100;

const validators = {
  input: m => m.input && typeof m.input === "object" &&
    ["left", "right", "jump"].every(k => m.input[k] === undefined || typeof m.input[k] === "boolean"),
  choose_shaman: () => true,
  place_shaman_object: m => typeof m.kind === "string" && m.kind.length <= 24 &&
    finite(m.x, -10000, 10000) && finite(m.y, -10000, 10000) &&
    (m.rotation === undefined || finite(m.rotation, -360, 360)),
  remove_shaman_object: m => id(m.objectId),
  connect_shaman_objects: m => id(m.objectA) && id(m.objectB) &&
    finite(m.anchorX, -10000, 10000) && finite(m.anchorY, -10000, 10000),
  disconnect_shaman_objects: m => id(m.jointId),
  request_snapshot: () => true,
  ping: () => true
};

export function decodeRequest(raw, { maxBytes = 8192 } = {}) {
  if (typeof raw !== "string" || raw.length > maxBytes) {
    return { ok: false, error: "request_size_invalid" };
  }
  let message;
  try { message = JSON.parse(raw); }
  catch { return { ok: false, error: "invalid_json" }; }

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { ok: false, error: "invalid_message" };
  }
  if (message.version !== PROTOCOL_VERSION) return { ok: false, error: "protocol_version_unsupported" };
  if (typeof message.type !== "string" || !validators[message.type]) {
    return { ok: false, error: "unknown_command" };
  }
  if (!validators[message.type](message)) return { ok: false, error: "invalid_payload" };

  return {
    ok: true,
    request: {
      version: PROTOCOL_VERSION,
      requestId: typeof message.requestId === "string" ? message.requestId.slice(0, 80) : null,
      type: message.type,
      payload: Object.fromEntries(Object.entries(message).filter(([key]) =>
        !["version", "requestId", "type"].includes(key)))
    }
  };
}

export function encodeMessage(type, payload = {}, requestId = null) {
  if (typeof type !== "string" || !REQUEST_TYPES.includes(type)) throw new Error("unknown_command");
  return JSON.stringify({ version: PROTOCOL_VERSION, type, requestId, ...payload });
}

export function encodeResponse(type, payload = {}) {
  return JSON.stringify({ version: PROTOCOL_VERSION, type, ...payload });
}
