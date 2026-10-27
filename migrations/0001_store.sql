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

-- Initial server catalog mirrors currently purchasable, non-exclusive cosmetics.
-- Prices are authoritative on the server; the client must never submit a price.
INSERT OR IGNORE INTO ratopolis_store_catalog
  (code, name, description, category, price_coins, item_payload, active, sort_order)
VALUES
  ('leaf', 'Folha da floresta', 'Um acessório natural para exploradores.', 'cosmetic', 20, '{"type":"hat","hatId":"leaf","icon":"🍃"}', 1, 10),
  ('shopGlasses', 'Óculos de explorador', 'Óculos estilosos para encarar qualquer fase.', 'cosmetic', 35, '{"type":"hat","hatId":"shopGlasses","icon":"🥽"}', 1, 20),
  ('shopScarf', 'Lenço aventureiro', 'Um lenço colorido para o seu ratinho.', 'cosmetic', 45, '{"type":"hat","hatId":"shopScarf","icon":"🧣"}', 1, 30),
  ('shopBackpack', 'Mochila de explorador', 'Leve seu espírito aventureiro para cada toca.', 'cosmetic', 55, '{"type":"hat","hatId":"shopBackpack","icon":"🎒"}', 1, 40),
  ('crown', 'Coroa dourada', 'Para quem quer correr como realeza.', 'cosmetic', 60, '{"type":"hat","hatId":"crown","icon":"👑"}', 1, 50),
  ('shopHelmet', 'Capacete de madeira', 'Proteção cosmética para quem não teme obstáculos.', 'cosmetic', 70, '{"type":"hat","hatId":"shopHelmet","icon":"⛑️"}', 1, 60),
  ('teamBrazil', 'Seleção Canarinho', 'Skin de time verde, amarela e azul.', 'cosmetic', 90, '{"type":"hat","hatId":"teamBrazil","icon":"🇧🇷"}', 1, 70),
  ('teamPortugal', 'Seleção das Quinas', 'Skin de time verde e vermelha.', 'cosmetic', 90, '{"type":"hat","hatId":"teamPortugal","icon":"🇵🇹"}', 1, 80),
  ('teamArgentina', 'Seleção Albiceleste', 'Skin de time azul-celeste e branca.', 'cosmetic', 90, '{"type":"hat","hatId":"teamArgentina","icon":"🇦🇷"}', 1, 90),
  ('teamFrance', 'Seleção Tricolor', 'Skin de time azul, branca e vermelha.', 'cosmetic', 90, '{"type":"hat","hatId":"teamFrance","icon":"🇫🇷"}', 1, 100),
  ('teamJapan', 'Seleção Samurai', 'Skin de time branca e vermelha.', 'cosmetic', 90, '{"type":"hat","hatId":"teamJapan","icon":"🇯🇵"}', 1, 110),
  ('teamMexico', 'Seleção Verde', 'Skin de time verde, branca e vermelha.', 'cosmetic', 90, '{"type":"hat","hatId":"teamMexico","icon":"🇲🇽"}', 1, 120),
  ('teamGermany', 'Seleção Germânica', 'Skin de time preta, vermelha e dourada.', 'cosmetic', 90, '{"type":"hat","hatId":"teamGermany","icon":"🇩🇪"}', 1, 130),
  ('teamUSA', 'Seleção Estrelada', 'Skin de time azul, branca e vermelha.', 'cosmetic', 90, '{"type":"hat","hatId":"teamUSA","icon":"🇺🇸"}', 1, 140),
  ('wizard', 'Chapéu mágico', 'Um toque de magia na aventura.', 'cosmetic', 100, '{"type":"hat","hatId":"wizard","icon":"🧙"}', 1, 150);
