/** HTML5 Client module. No Adobe Flash dependency; snapshots remain authoritative. */
export { AuthoritativeRoomClient } from "../../client/network/authoritative-room-client.js";

export class SnapshotBuffer {
  constructor({ maxSamples = 20, interpolationDelayMs = 100 } = {}) {
    this.maxSamples = Math.max(2, maxSamples);
    this.interpolationDelayMs = Math.max(0, interpolationDelayMs);
    this.samples = [];
  }
  push(snapshot, receivedAt = Date.now()) {
    if (!snapshot || !Number.isFinite(snapshot.sequence)) return false;
    const last = this.samples.at(-1);
    if (last && snapshot.sequence <= last.snapshot.sequence) return false;
    this.samples.push({ snapshot, receivedAt });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    return true;
  }
  latest() { return this.samples.at(-1)?.snapshot ?? null; }
  sample(now = Date.now()) {
    if (!this.samples.length) return null;
    const target = now - this.interpolationDelayMs;
    let before = this.samples[0], after = this.samples.at(-1);
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].receivedAt >= target) {
        before = this.samples[i - 1]; after = this.samples[i]; break;
      }
    }
    const span = after.receivedAt - before.receivedAt;
    const t = span > 0 ? Math.max(0, Math.min(1, (target - before.receivedAt) / span)) : 1;
    const a = before.snapshot.world?.players ?? [];
    const b = after.snapshot.world?.players ?? [];
    const byId = new Map(b.map(p => [String(p.id), p]));
    const players = a.map(p => {
      const q = byId.get(String(p.id));
      if (!q) return p;
      return { ...q, x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }).concat(b.filter(p => !a.some(q => String(q.id) === String(p.id))));
    return { ...after.snapshot, world: { ...after.snapshot.world, players } };
  }
  clear() { this.samples.length = 0; }
}
