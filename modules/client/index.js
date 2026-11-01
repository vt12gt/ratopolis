/**
 * Ratopolis Client Module
 * Presentation-side boundary. It never owns authoritative position, collision,
 * identity or progression; those values arrive from the server snapshot.
 */
export class RatopolisClient extends EventTarget {
  constructor({ transport, renderer = null, controls = null } = {}) {
    super();
    if (!transport) throw new Error("client_transport_required");
    this.transport = transport;
    this.renderer = renderer;
    this.controls = controls;
    this.latestSnapshot = null;
    this.connected = false;
    this._onState = event => this.applyServerMessage(event.detail);
    this._onConnected = () => {
      this.connected = true;
      this.dispatchEvent(new Event("connected"));
    };
    this._onDisconnected = () => {
      this.connected = false;
      this.dispatchEvent(new Event("disconnected"));
    };
    transport.addEventListener?.("state", this._onState);
    transport.addEventListener?.("connected", this._onConnected);
    transport.addEventListener?.("disconnected", this._onDisconnected);
  }

  async connect() {
    await this.transport.connect();
    return true;
  }

  sendInput({ left = false, right = false, jump = false } = {}) {
    return this.transport.input({ left: !!left, right: !!right, jump: !!jump });
  }

  chooseShaman() { return this.transport.chooseShaman(); }
  placeShamanObject(kind, x, y, rotation = 0) {
    return this.transport.placeObject(kind, x, y, rotation);
  }
  connectShamanObjects(objectA, objectB, anchorX, anchorY) {
    return this.transport.connectObjects(objectA, objectB, anchorX, anchorY);
  }
  removeShamanObject(objectId) { return this.transport.removeObject(objectId); }

  applyServerMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "room_snapshot" || message.roomId) {
      this.latestSnapshot = message;
      // Renderer receives a read-only copy; it cannot write state back.
      this.renderer?.renderSnapshot?.(structuredClone(message));
      this.dispatchEvent(new CustomEvent("snapshot", { detail: structuredClone(message) }));
    } else {
      this.dispatchEvent(new CustomEvent("server-message", { detail: message }));
    }
  }

  attachControls() {
    if (!this.controls?.onInput) return false;
    this.controls.onInput(input => this.sendInput(input));
    return true;
  }

  disconnect() {
    this.transport.close?.();
    this.connected = false;
  }

  destroy() {
    this.disconnect();
    this.transport.removeEventListener?.("state", this._onState);
    this.transport.removeEventListener?.("connected", this._onConnected);
    this.transport.removeEventListener?.("disconnected", this._onDisconnected);
  }
}
