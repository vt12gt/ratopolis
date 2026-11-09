-- RativaPolis Guild CP — incremental migration
-- CP = Contribution Points. Kept separate from cheese and guild XP.
ALTER TABLE rativapolis_guild_members
 ADD COLUMN contribution_points INTEGER NOT NULL DEFAULT 0 CHECK(contribution_points>=0);

CREATE TABLE IF NOT EXISTS rativapolis_guild_cp_events (
 event_id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL REFERENCES rativapolis_guilds(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES game_users(id),
 points INTEGER NOT NULL CHECK(points>0),
 source TEXT NOT NULL CHECK(source IN ('donation','phase_complete')),
 created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rp_guild_cp_member
 ON rativapolis_guild_cp_events(guild_id,user_id,created_at DESC);
