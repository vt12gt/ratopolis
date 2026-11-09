PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_users (id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE CHECK (public_id GLOB 'RS-*'), nickname TEXT NOT NULL COLLATE NOCASE UNIQUE, email TEXT COLLATE NOCASE UNIQUE, legacy_user_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','mod','gm','adm','spadm')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS game_credentials (user_id TEXT PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, password_scheme TEXT NOT NULL DEFAULT 'legacy-compatible', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS game_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), revoked_at TEXT);
CREATE TABLE IF NOT EXISTS game_audit_logs (id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL, action TEXT NOT NULL, target_user_id TEXT, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS idx_game_users_nickname ON game_users(nickname);
CREATE INDEX IF NOT EXISTS idx_game_users_legacy ON game_users(legacy_user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expiry ON game_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_game_audit_actor_time ON game_audit_logs(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_game_audit_target_time ON game_audit_logs(target_user_id, created_at);
