-- Server-issued, single-use phase tickets for RativaPolis reward claims.
CREATE TABLE IF NOT EXISTS ratopolis_phase_sessions (
  ticket_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 12),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_polis_phase_sessions_user_issued
  ON ratopolis_phase_sessions(user_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_polis_phase_sessions_expiry
  ON ratopolis_phase_sessions(expires_at);
