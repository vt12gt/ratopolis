-- Additive only: do not infer this value from legacy_user_id or the new local UUID.
-- Populate portal_user_id only after an audited, unambiguous match to ratopolis_users.id.
ALTER TABLE game_users ADD COLUMN portal_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_snack_game_users_portal_user
  ON game_users(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_snack_game_users_portal_nickname
  ON game_users(portal_user_id, nickname);
