-- Once assigned, a public Portal ID must never change.
CREATE TRIGGER IF NOT EXISTS trg_portal_public_id_immutable
BEFORE UPDATE OF public_id ON ratopolis_users
WHEN OLD.public_id IS NOT NULL AND NEW.public_id <> OLD.public_id
BEGIN
  SELECT RAISE(ABORT, 'portal_public_id_immutable');
END;
