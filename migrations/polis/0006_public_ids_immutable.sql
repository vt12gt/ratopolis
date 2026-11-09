-- Once assigned, a Rativapolis public ID must never change.
CREATE TRIGGER IF NOT EXISTS trg_polis_public_id_immutable
BEFORE UPDATE OF public_id ON game_users
WHEN OLD.public_id IS NOT NULL AND NEW.public_id <> OLD.public_id
BEGIN
  SELECT RAISE(ABORT, 'polis_public_id_immutable');
END;
