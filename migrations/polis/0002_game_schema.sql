PRAGMA foreign_keys = ON;

CREATE TABLE ratopolis_coin_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('store_purchase','store_refund','admin_adjustment','reward')), amount INTEGER NOT NULL, balance_before INTEGER NOT NULL CHECK (balance_before >= 0), balance_after INTEGER NOT NULL CHECK (balance_after >= 0), reference_id TEXT, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE ratopolis_daily_reward_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 30),
  coins_awarded INTEGER NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0),
  xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, claim_date)
);

CREATE TABLE ratopolis_events (
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

CREATE TABLE ratopolis_gift_redemptions (
  id TEXT PRIMARY KEY, gift_id TEXT NOT NULL REFERENCES ratopolis_gifts(id), user_id TEXT NOT NULL, code TEXT NOT NULL,
  coins_awarded INTEGER NOT NULL DEFAULT 0, xp_awarded INTEGER NOT NULL DEFAULT 0, item_code TEXT NOT NULL DEFAULT '',
  item_quantity INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, UNIQUE(gift_id, user_id)
);

CREATE TABLE ratopolis_gifts (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins >= 0), reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  reward_item TEXT NOT NULL DEFAULT '', reward_quantity INTEGER NOT NULL DEFAULT 1 CHECK (reward_quantity >= 1),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Pausado','Encerrado')), max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_by TEXT NOT NULL, created_by_nickname TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE ratopolis_item_registry (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, item_type TEXT NOT NULL, source TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ratopolis_paid_vip (
  user_id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  last_order_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE,
  FOREIGN KEY (last_order_id) REFERENCES ratopolis_store_orders(id)
);

CREATE TABLE ratopolis_profiles (   user_id TEXT PRIMARY KEY,   level INTEGER NOT NULL DEFAULT 1     CHECK (level BETWEEN 1 AND 50),   xp INTEGER NOT NULL DEFAULT 0     CHECK (xp >= 0),   vip_level INTEGER NOT NULL DEFAULT 0     CHECK (vip_level BETWEEN 0 AND 15),   coins INTEGER NOT NULL DEFAULT 0     CHECK (coins >= 0),   FOREIGN KEY (user_id)     REFERENCES game_users(id)     ON DELETE CASCADE );

CREATE TABLE ratopolis_reward_events (   event_id TEXT PRIMARY KEY,   user_id TEXT NOT NULL,   event_type TEXT NOT NULL,   xp_awarded INTEGER NOT NULL DEFAULT 0,   coins_awarded INTEGER NOT NULL DEFAULT 0,   created_at TEXT NOT NULL,   FOREIGN KEY (user_id) REFERENCES game_users(id) );

CREATE TABLE ratopolis_scenario_reviews (   id TEXT PRIMARY KEY,   scenario_id TEXT NOT NULL,   version_id TEXT NOT NULL,   reviewer_user_id TEXT NOT NULL,   decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),   reason TEXT NOT NULL DEFAULT '',   created_at TEXT NOT NULL,   CHECK (decision != 'rejected' OR length(trim(reason)) > 0),   FOREIGN KEY (scenario_id) REFERENCES ratopolis_scenarios(id) ON DELETE CASCADE,   FOREIGN KEY (version_id) REFERENCES ratopolis_scenario_versions(id) ON DELETE CASCADE,   FOREIGN KEY (reviewer_user_id) REFERENCES game_users(id) );

CREATE TABLE ratopolis_scenario_staff (user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('editor')), granted_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE, FOREIGN KEY (granted_by_user_id) REFERENCES game_users(id));

CREATE TABLE ratopolis_scenario_versions (   id TEXT PRIMARY KEY,   scenario_id TEXT NOT NULL,   version_number INTEGER NOT NULL,   layout_json TEXT NOT NULL,   notes TEXT NOT NULL DEFAULT '',   created_by_user_id TEXT NOT NULL,   created_at TEXT NOT NULL,   UNIQUE (scenario_id, version_number),   FOREIGN KEY (scenario_id) REFERENCES ratopolis_scenarios(id) ON DELETE CASCADE,   FOREIGN KEY (created_by_user_id) REFERENCES game_users(id) );

CREATE TABLE ratopolis_scenarios (   id TEXT PRIMARY KEY,   name TEXT NOT NULL,   description TEXT NOT NULL DEFAULT '',   creator_user_id TEXT NOT NULL,   status TEXT NOT NULL DEFAULT 'draft'     CHECK (status IN ('draft', 'submitted', 'in_review', 'rejected', 'approved', 'published')),   current_version INTEGER NOT NULL DEFAULT 1,   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL,   submitted_at TEXT,   approved_at TEXT,   published_at TEXT,   FOREIGN KEY (creator_user_id) REFERENCES game_users(id) );

CREATE TABLE ratopolis_store_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'cosmetic' CHECK (category IN ('cosmetic','consumable','boost','bundle')), price_coins INTEGER NOT NULL CHECK (price_coins >= 0), item_payload TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 100, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE ratopolis_store_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, item_code TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0), equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)), acquired_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, item_code));

CREATE TABLE ratopolis_store_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','refunded','charged_back')),
  provider TEXT NOT NULL DEFAULT 'mercadopago' CHECK (provider = 'mercadopago'),
  provider_preference_id TEXT,
  provider_payment_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE ratopolis_store_purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, item_code TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price_coins INTEGER NOT NULL CHECK (unit_price_coins >= 0), total_price_coins INTEGER NOT NULL CHECK (total_price_coins >= 0), status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')), idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, idempotency_key));
