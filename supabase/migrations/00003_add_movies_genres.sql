-- ─── Add genres column to movies table ───
-- Stores genre names as a text array for direct display (no join needed)

ALTER TABLE movies
ADD COLUMN IF NOT EXISTS genres text[];
