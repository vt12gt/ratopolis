PRAGMA foreign_keys = ON;

CREATE TABLE rato_snack_achievements (
  user_id TEXT NOT NULL,
  achievement_code TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  unlocked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_code),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE rato_snack_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)),
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, item_code),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE rato_snack_monthly_periods (month_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')), winner_user_id TEXT, winner_nickname TEXT, winner_total_size INTEGER NOT NULL DEFAULT 0 CHECK(winner_total_size>=0), closed_at TEXT, announced_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE rato_snack_monthly_size (month_key TEXT NOT NULL, user_id TEXT NOT NULL, total_size INTEGER NOT NULL DEFAULT 0 CHECK(total_size>=0), games_count INTEGER NOT NULL DEFAULT 0 CHECK(games_count>=0), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(month_key,user_id), FOREIGN KEY(user_id) REFERENCES game_users(id) ON DELETE CASCADE);

CREATE TABLE rato_snack_profiles (
  user_id TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE rato_snack_rank_cycles (cycle_key TEXT PRIMARY KEY, starts_at TEXT NOT NULL, closes_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','awarded')), closed_at TEXT, awarded_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE rato_snack_rank_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_key TEXT NOT NULL, user_id TEXT NOT NULL, nickname_snapshot TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5), total_score INTEGER NOT NULL CHECK(total_score >= 0), games_count INTEGER NOT NULL CHECK(games_count >= 0), snapshot_at TEXT NOT NULL, UNIQUE(cycle_key,user_id), UNIQUE(cycle_key,position), FOREIGN KEY(cycle_key) REFERENCES rato_snack_rank_cycles(cycle_key), FOREIGN KEY(user_id) REFERENCES game_users(id));

CREATE TABLE rato_snack_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('online','offline')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
);
