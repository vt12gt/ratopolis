-- Central public identity for Rativa Games Portal (RV- + five characters).
ALTER TABLE ratopolis_users ADD COLUMN public_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratopolis_users_public_id
  ON ratopolis_users(public_id) WHERE public_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_portal_public_id_validate_insert
BEFORE INSERT ON ratopolis_users
WHEN NEW.public_id IS NULL
  OR length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RV-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_portal_public_id');
END;

CREATE TRIGGER IF NOT EXISTS trg_portal_public_id_validate_update
BEFORE UPDATE OF public_id ON ratopolis_users
WHEN NEW.public_id IS NULL
  OR length(NEW.public_id) <> 8
  OR substr(NEW.public_id, 1, 3) <> 'RV-'
  OR substr(NEW.public_id, 4) GLOB '*[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]*'
BEGIN
  SELECT RAISE(ABORT, 'invalid_portal_public_id');
END;
