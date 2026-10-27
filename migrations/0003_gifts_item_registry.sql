-- Gifts redeemable by authenticated players and registry of items implemented in the game.
CREATE TABLE IF NOT EXISTS ratopolis_gifts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  reward_item TEXT NOT NULL DEFAULT '',
  reward_quantity INTEGER NOT NULL DEFAULT 1 CHECK (reward_quantity >= 1),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Pausado','Encerrado')),
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by TEXT NOT NULL,
  created_by_nickname TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ratopolis_gifts_status ON ratopolis_gifts(status, created_at DESC);
CREATE TABLE IF NOT EXISTS ratopolis_gift_redemptions (
  id TEXT PRIMARY KEY,
  gift_id TEXT NOT NULL REFERENCES ratopolis_gifts(id),
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  item_code TEXT NOT NULL DEFAULT '',
  item_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(gift_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ratopolis_gift_redemptions_user ON ratopolis_gift_redemptions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ratopolis_item_registry (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  item_type TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO ratopolis_item_registry (code,name,category,item_type,source,description) VALUES
('leaf','Folha da floresta','Cosmético','Acessório','Loja','Acessório visual de folha.'),
('crown','Coroa dourada','Cosmético','Acessório','Loja','Coroa visual.'),
('wizard','Chapéu mágico','Cosmético','Acessório','Loja','Chapéu de feiticeiro.'),
('shopGlasses','Óculos de explorador','Cosmético','Acessório','Loja','Óculos visuais.'),
('shopScarf','Lenço aventureiro','Cosmético','Acessório','Loja','Lenço visual.'),
('shopBackpack','Mochila de explorador','Cosmético','Acessório','Loja','Mochila visual.'),
('shopHelmet','Capacete de madeira','Cosmético','Acessório','Loja','Capacete visual.'),
('teamBrazil','Seleção Canarinho','Cosmético','Tema de seleção','Loja','Visual da seleção brasileira.'),
('teamPortugal','Seleção das Quinas','Cosmético','Tema de seleção','Loja','Visual da seleção portuguesa.'),
('teamArgentina','Seleção Albiceleste','Cosmético','Tema de seleção','Loja','Visual da seleção argentina.'),
('teamFrance','Seleção Tricolor','Cosmético','Tema de seleção','Loja','Visual da seleção francesa.'),
('teamJapan','Seleção Samurai','Cosmético','Tema de seleção','Loja','Visual da seleção japonesa.'),
('teamMexico','Seleção Verde','Cosmético','Tema de seleção','Loja','Visual da seleção mexicana.'),
('teamGermany','Seleção Germânica','Cosmético','Tema de seleção','Loja','Visual da seleção alemã.'),
('teamUSA','Seleção Estrelada','Cosmético','Tema de seleção','Loja','Visual da seleção dos Estados Unidos.'),
('starhalo','Halo estelar','Cosmético','Acessório','Recompensa','Acessório especial de recompensa.'),
('royalwings','Asas reais','Cosmético','Acessório','Recompensa','Asas especiais de recompensa.'),
('guardianCape','Capa guardiã','Cosmético','Acessório','Recompensa','Capa especial de recompensa.'),
('levelLeaf','Folha de nível','Cosmético','Acessório','Recompensa','Acessório de progressão.'),
('goldEars','Orelhas douradas','Cosmético','Acessório','Recompensa','Acessório especial de recompensa.'),
('crystalAura','Aura de cristal','Cosmético','Aura','Recompensa','Aura especial de recompensa.'),
('auroraWings','Asas da aurora','Cosmético','Acessório','Recompensa','Asas especiais de recompensa.'),
('ratopolisCrown','Coroa de Ratópolis','Cosmético','Acessório','Recompensa','Coroa especial de Ratópolis.'),
('burrow_runner','Corredor da Toca','Título','Título de jogador','Conquista','Título desbloqueável.'),
('cheese_hunter_title','Caçador de Queijo','Título','Título de jogador','Conquista','Título desbloqueável.'),
('acorn_guardian','Guardião das Bolotas','Título','Título de jogador','Conquista','Título desbloqueável.'),
('explorer_title','Explorador','Título','Título de jogador','Conquista','Título desbloqueável.'),
('speedy_mouse','Rato Veloz','Título','Título de jogador','Conquista','Título desbloqueável.'),
('ratopolis_legend','Lenda de Ratópolis','Título','Título de jogador','Conquista','Título desbloqueável.');
