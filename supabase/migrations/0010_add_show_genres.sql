-- ─── Add genres column to shows table ───
-- Stores genre names as a text array for direct display

ALTER TABLE shows
ADD COLUMN IF NOT EXISTS genres text[];