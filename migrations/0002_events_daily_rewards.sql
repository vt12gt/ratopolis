-- RATOPOLIS Events + Daily Rewards v1
-- Apply once to the existing Ratopolis D1 database.

CREATE TABLE IF NOT EXISTS ratopolis_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL DEFAULT '',
  end_at TEXT NOT NULL DEFAULT '',
  reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins BETWEEN 0 AND 100000),
  reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp BETWEEN 0 AND 100000),
  reward_item TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho','Publicado','Encerrado','Cancelado')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ratopolis_events_status_dates ON ratopolis_events(status, start_at, end_at);

CREATE TABLE IF NOT EXISTS ratopolis_daily_reward_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  start_date TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 7 CHECK (duration_days IN (7,14,30)),
  rewards_json TEXT NOT NULL DEFAULT '[]',
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratopolis_daily_reward_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 30),
  coins_awarded INTEGER NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0),
  xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, claim_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user ON ratopolis_daily_reward_claims(user_id, claim_date DESC);
