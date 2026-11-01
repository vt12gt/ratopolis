/** Request module: strict wire-message validation and command helpers. */
import { COMMANDS, validateCommand } from "../../shared/protocol/commands.js";
export { COMMANDS, validateCommand };

export function createRequest(type, payload = {}, requestId = undefined) {
  if (typeof type !== "string" || !type) throw new TypeError("type obrigatório");
  const message = { type, ...payload };
  if (requestId !== undefined) message.requestId = String(requestId);
  const checked = parseRequest(message);
  if (!checked.ok) throw new TypeError(checked.error);
  return message;
}

export function parseRequest(raw) {
  const checked = validateCommand(raw);
  if (!checked.ok) return checked;
  const { message } = checked;
  if (message.requestId !== undefined &&
      (typeof message.requestId !== "string" || message.requestId.length > 128)) {
    return { ok: false, error: "invalid_request_id" };
  }
  return checked;
}
