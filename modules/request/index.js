/**
 * Ratopolis Request Module
 * Versioned, transport-neutral wire contract. The transport must call
 * decodeRequest before dispatching anything to the room/server authority.
 */
export const PROTOCOL_VERSION = 1;
export const MAX_REQUEST_BYTES = 8192;
export const REQUEST_TYPES = Object.freeze([
  "input", "choose_shaman", "place_shaman_object", "remove_shaman_object",
  "connect_shaman_objects", "disconnect_shaman_objects", "request_snapshot", "ping"
]);

const finite = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const validId = value => typeof value === "string" && value.length > 0 && value.length <= 100;
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (m, allowed) => Object.keys(m).every(key => allowed.includes(key));
const envelope = ["version", "requestId", "type"];

const validators = Object.freeze({
  input: m => onlyKeys(m, [...envelope, "input"]) && isRecord(m.input) &&
    Object.keys(m.input).every(k => ["left", "right", "jump"].includes(k)) &&
    ["left", "right", "jump"].every(k => m.input[k] === undefined || typeof m.input[k] === "boolean"),
  choose_shaman: m => onlyKeys(m, envelope),
  place_shaman_object: m => onlyKeys(m, [...envelope, "kind", "x", "y", "rotation"]) && typeof m.kind === "string" && m.kind.length > 0 && m.kind.length <= 24 &&
    finite(m.x, -10000, 10000) && finite(m.y, -10000, 10000) &&
    (m.rotation === undefined || finite(m.rotation, -360, 360)),
  remove_shaman_object: m => onlyKeys(m, [...envelope, "objectId"]) && validId(m.objectId),
  connect_shaman_objects: m => onlyKeys(m, [...envelope, "objectA", "objectB", "anchorX", "anchorY"]) && validId(m.objectA) && validId(m.objectB) && m.objectA !== m.objectB &&
    finite(m.anchorX, -10000, 10000) && finite(m.anchorY, -10000, 10000),
  disconnect_shaman_objects: m => onlyKeys(m, [...envelope, "jointId"]) && validId(m.jointId),
  request_snapshot: m => onlyKeys(m, envelope),
  ping: m => onlyKeys(m, [...envelope, "clientTime"]) &&
    (m.clientTime === undefined || finite(m.clientTime, 0, Number.MAX_SAFE_INTEGER))
});

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function decodeRequest(raw, { maxBytes = MAX_REQUEST_BYTES } = {}) {
  if (typeof raw !== "string" || !Number.isInteger(maxBytes) || maxBytes < 1 ||
      utf8ByteLength(raw) > maxBytes) return { ok: false, error: "request_size_invalid" };

  let message;
  try { message = JSON.parse(raw); }
  catch { return { ok: false, error: "invalid_json" }; }

  if (!isRecord(message)) return { ok: false, error: "invalid_message" };
  if (message.version !== PROTOCOL_VERSION) return { ok: false, error: "protocol_version_unsupported" };
  if (typeof message.type !== "string" || !validators[message.type]) {
    return { ok: false, error: "unknown_command" };
  }
  if (message.requestId !== undefined &&
      (typeof message.requestId !== "string" || message.requestId.length < 1 || message.requestId.length > 80)) {
    return { ok: false, error: "request_id_invalid" };
  }
  if (!validators[message.type](message)) return { ok: false, error: "invalid_payload" };

  const payload = Object.create(null);
  for (const [key, value] of Object.entries(message)) {
    if (!["version", "requestId", "type"].includes(key)) payload[key] = value;
  }
  return { ok: true, request: {
    version: PROTOCOL_VERSION,
    requestId: message.requestId ?? null,
    type: message.type,
    payload
  }};
}

export function encodeMessage(type, payload = {}, requestId = null) {
  if (typeof type !== "string" || !REQUEST_TYPES.includes(type)) throw new Error("unknown_command");
  if (!isRecord(payload)) throw new Error("payload_invalid");
  if (requestId !== null && (typeof requestId !== "string" || !requestId.length || requestId.length > 80)) {
    throw new Error("request_id_invalid");
  }
  // Reserved envelope fields cannot be overridden by payload.
  for (const key of ["version", "type", "requestId"]) {
    if (Object.hasOwn(payload, key)) throw new Error("reserved_envelope_field");
  }
  const raw = JSON.stringify({ ...payload, version: PROTOCOL_VERSION, type, requestId });
  if (utf8ByteLength(raw) > MAX_REQUEST_BYTES) throw new Error("request_size_invalid");
  const checked = decodeRequest(raw);
  if (!checked.ok) throw new Error(checked.error);
  return raw;
}

export function encodeResponse(type, payload = {}) {
  if (typeof type !== "string" || !type || !isRecord(payload)) throw new Error("response_invalid");
  for (const key of ["version", "type"]) {
    if (Object.hasOwn(payload, key)) throw new Error("reserved_envelope_field");
  }
  return JSON.stringify({ ...payload, version: PROTOCOL_VERSION, type });
}
