-- Rativapolis public IDs are RP- plus exactly five random characters.
CREATE TRIGGER IF NOT EXISTS trg_polis_public_id_validate_insert
BEFORE INSERT ON game_users
WHEN length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RP-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_polis_public_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_polis_public_id_validate_update
BEFORE UPDATE OF public_id ON game_users
WHEN length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RP-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_polis_public_id');
END;
