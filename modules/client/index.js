/**
 * Ratopolis Client Module
 * HTML5 presentation boundary. Server snapshots are authoritative.
 */
export class RatopolisClient extends EventTarget {
  constructor({ transport, renderer = null, controls = null } = {}) {
    super();
    if (!transport || typeof transport.connect !== "function" || typeof transport.input !== "function") {
      throw new Error("client_transport_invalid");
    }
    this.transport = transport;
    this.renderer = renderer;
    this.controls = controls;
    this.latestSnapshot = null;
    this.connected = false;
    this.destroyed = false;
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
    if (this.destroyed) throw new Error("client_destroyed");
    await this.transport.connect();
    return true;
  }
  sendInput({ left = false, right = false, jump = false } = {}) {
    if (!this.connected) throw new Error("client_not_connected");
    return this.transport.input({ left: !!left, right: !!right, jump: !!jump });
  }
  chooseShaman() { return this.sendAction("chooseShaman"); }
  placeShamanObject(kind, x, y, rotation = 0) {
    return this.sendAction("placeObject", kind, x, y, rotation);
  }
  connectShamanObjects(objectA, objectB, anchorX, anchorY) {
    return this.sendAction("connectObjects", objectA, objectB, anchorX, anchorY);
  }
  removeShamanObject(objectId) { return this.sendAction("removeObject", objectId); }
  disconnectShamanObjects(jointId) { return this.sendAction("disconnectJoint", jointId); }

  sendAction(method, ...args) {
    if (!this.connected) throw new Error("client_not_connected");
    if (typeof this.transport[method] !== "function") throw new Error("transport_action_unsupported");
    return this.transport[method](...args);
  }

  applyServerMessage(message) {
    if (!message || typeof message !== "object") return false;
    if (message.type === "room_snapshot" || message.roomId) {
      const snapshot = structuredClone(message);
      this.latestSnapshot = snapshot;
      this.renderer?.renderSnapshot?.(structuredClone(snapshot));
      this.dispatchEvent(new CustomEvent("snapshot", { detail: structuredClone(snapshot) }));
      return true;
    }
    this.dispatchEvent(new CustomEvent("server-message", { detail: structuredClone(message) }));
    return true;
  }
  attachControls() {
    if (!this.controls?.onInput) return false;
    this.controls.onInput(input => {
      if (this.connected) this.sendInput(input);
    });
    return true;
  }
  disconnect() {
    this.transport.close?.();
    this.connected = false;
  }
  destroy() {
    if (this.destroyed) return;
    this.disconnect();
    this.destroyed = true;
    this.transport.removeEventListener?.("state", this._onState);
    this.transport.removeEventListener?.("connected", this._onConnected);
    this.transport.removeEventListener?.("disconnected", this._onDisconnected);
  }
}
