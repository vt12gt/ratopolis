-- RativaSnack public IDs are RS- plus exactly five random characters.
CREATE TRIGGER IF NOT EXISTS trg_snack_public_id_validate_insert
BEFORE INSERT ON game_users
WHEN length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RS-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_snack_public_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_snack_public_id_validate_update
BEFORE UPDATE OF public_id ON game_users
WHEN length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RS-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_snack_public_id');
END;
