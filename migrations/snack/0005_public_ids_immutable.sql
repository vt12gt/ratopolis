-- Once assigned, a RativaSnack public ID must never change.
CREATE TRIGGER IF NOT EXISTS trg_snack_public_id_immutable
BEFORE UPDATE OF public_id ON game_users
WHEN OLD.public_id IS NOT NULL AND NEW.public_id <> OLD.public_id
BEGIN
  SELECT RAISE(ABORT, 'snack_public_id_immutable');
END;
