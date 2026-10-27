-- RATÓPOLIS Store v1
-- Apply to the existing D1 database before enabling store purchase routes.
-- Does not alter existing users/profiles/orders or change coin balances.

CREATE TABLE IF NOT EXISTS ratopolis_store_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'cosmetic'
    CHECK (category IN ('cosmetic','consumable','boost','bundle')),
  price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
  item_payload TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratopolis_store_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  equipped INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)),
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_user
  ON ratopolis_store_inventory(user_id, acquired_at DESC);

CREATE TABLE IF NOT EXISTS ratopolis_store_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_coins INTEGER NOT NULL CHECK (unit_price_coins >= 0),
  total_price_coins INTEGER NOT NULL CHECK (total_price_coins >= 0),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed','refunded')),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_store_purchases_user
  ON ratopolis_store_purchases(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ratopolis_coin_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('store_purchase','store_refund','admin_adjustment','reward')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user
  ON ratopolis_coin_ledger(user_id, created_at DESC);
