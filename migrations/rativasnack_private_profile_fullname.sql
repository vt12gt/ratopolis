-- RativaSnack private player profile
-- Applied to D1 database ratosnack-dev-isolated on 2026-11-11.
ALTER TABLE rato_snack_pix_profiles ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE rato_snack_event_registrations ADD COLUMN full_name_snapshot TEXT NOT NULL DEFAULT '';
