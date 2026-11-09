-- RativaPolis Guild System — D1 migration
-- Target: POLIS_DB (rativapolis-dev-isolated)
-- Depends on existing game_users and ratopolis_profiles tables.

CREATE TABLE IF NOT EXISTS rativapolis_guilds (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL COLLATE NOCASE UNIQUE,
 tag TEXT NOT NULL COLLATE NOCASE UNIQUE,
 description TEXT NOT NULL DEFAULT '',
 emblem TEXT NOT NULL DEFAULT '🛡️',
 bulletin TEXT NOT NULL DEFAULT '',
 leader_user_id TEXT NOT NULL REFERENCES game_users(id),
 level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 50),
 xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),
 bank_cheese INTEGER NOT NULL DEFAULT 0 CHECK(bank_cheese>=0),
 member_limit INTEGER NOT NULL DEFAULT 30 CHECK(member_limit>=30),
 total_donations INTEGER NOT NULL DEFAULT 0 CHECK(total_donations>=0),
 mission_points INTEGER NOT NULL DEFAULT 0 CHECK(mission_points>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_members (
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL UNIQUE REFERENCES game_users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('leader','vice','general','officer','veteran','member','recruit')),
 contribution_total INTEGER NOT NULL DEFAULT 0 CHECK(contribution_total>=0),
 joined_at TEXT NOT NULL,
 PRIMARY KEY(guild_id,user_id)
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_invites (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 inviter_user_id TEXT NOT NULL REFERENCES game_users(id),
 invitee_user_id TEXT NOT NULL REFERENCES game_users(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired','cancelled')),
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 responded_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_guild_invite_pending
 ON rativapolis_guild_invites(guild_id,invitee_user_id) WHERE status='pending';

CREATE TABLE IF NOT EXISTS rativapolis_guild_applications (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
 created_at TEXT NOT NULL,
 responded_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_guild_application_pending
 ON rativapolis_guild_applications(guild_id,user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_rp_guild_applications_guild
 ON rativapolis_guild_applications(guild_id,status,created_at);

CREATE TABLE IF NOT EXISTS rativapolis_guild_transactions (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES game_users(id),
 type TEXT NOT NULL CHECK(type IN ('donation','withdrawal','shop_purchase','refund','admin_adjustment')),
 amount INTEGER NOT NULL CHECK(amount>0),
 balance_before INTEGER NOT NULL CHECK(balance_before>=0),
 balance_after INTEGER NOT NULL CHECK(balance_after>=0),
 idempotency_key TEXT NOT NULL UNIQUE,
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 guild_xp_awarded INTEGER NOT NULL DEFAULT 0,
 mission_processed_at TEXT
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_missions (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 mission_code TEXT NOT NULL,
 period_key TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 event_type TEXT NOT NULL,
 difficulty TEXT NOT NULL DEFAULT 'normal',
 target INTEGER NOT NULL CHECK(target>0),
 progress INTEGER NOT NULL DEFAULT 0 CHECK(progress>=0),
 reward_xp INTEGER NOT NULL DEFAULT 0 CHECK(reward_xp>=0),
 reward_member_cheese INTEGER NOT NULL DEFAULT 0 CHECK(reward_member_cheese>=0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','expired')),
 starts_at TEXT NOT NULL,
 ends_at TEXT,
 completed_at TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(guild_id,mission_code,period_key)
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_mission_contributions (
 id TEXT PRIMARY KEY,
 mission_id TEXT NOT NULL REFERENCES rativapolis_guild_missions(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES game_users(id),
 event_id TEXT NOT NULL,
 progress INTEGER NOT NULL CHECK(progress>0),
 created_at TEXT NOT NULL,
 UNIQUE(mission_id,event_id)
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_game_events (
 event_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES game_users(id),
 guild_id TEXT REFERENCES rativapolis_guilds(id),
 phase INTEGER NOT NULL,
 cheeses INTEGER NOT NULL,
 acorns INTEGER NOT NULL,
 processed_at TEXT,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_shop_catalog (
 item_code TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'cosmetic',
 min_level INTEGER NOT NULL DEFAULT 1 CHECK(min_level BETWEEN 1 AND 50),
 price_cheese INTEGER NOT NULL CHECK(price_cheese>=0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_shop_purchases (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 item_code TEXT NOT NULL REFERENCES rativapolis_guild_shop_catalog(item_code),
 buyer_user_id TEXT NOT NULL REFERENCES game_users(id),
 quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0),
 price_total INTEGER NOT NULL CHECK(price_total>=0),
 idempotency_key TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_achievements (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 achievement_code TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 unlocked_at TEXT NOT NULL,
 UNIQUE(guild_id,achievement_code)
);

CREATE TABLE IF NOT EXISTS rativapolis_guild_audit_logs (
 id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 actor_user_id TEXT NOT NULL REFERENCES game_users(id),
 target_user_id TEXT REFERENCES game_users(id),
 action TEXT NOT NULL,
 details_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rp_guild_members_guild
 ON rativapolis_guild_members(guild_id,joined_at);
CREATE INDEX IF NOT EXISTS idx_rp_guild_transactions_guild
 ON rativapolis_guild_transactions(guild_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_guild_missions_guild
 ON rativapolis_guild_missions(guild_id,status,ends_at);
CREATE INDEX IF NOT EXISTS idx_rp_guild_rank
 ON rativapolis_guilds(status,level DESC,xp DESC,total_donations DESC);

INSERT OR IGNORE INTO rativapolis_guild_shop_catalog
(item_code,name,description,category,min_level,price_cheese,active) VALUES
('guild_banner_leaf','Estandarte da Folha','Um estandarte verde para a identidade da guilda.','banner',1,500,1),
('guild_emblem_gold','Emblema Dourado','Emblema especial para guildas experientes.','emblem',5,2500,1),
('guild_frame_royal','Moldura Real','Moldura exclusiva para o painel da guilda.','frame',10,5000,1),
('guild_aura_hero','Aura dos Heróis','Efeito visual coletivo desbloqueado pela guilda.','aura',20,12000,1),
('guild_title_legend','Título: Lenda da Toca','Título exclusivo para a guilda.','title',30,25000,1);
