-- ─── Add average_runtime to Shows ───
-- Stores the average episode runtime in seconds (matching movies.runtime convention)

ALTER TABLE shows
ADD COLUMN IF NOT EXISTS average_runtime INTEGER; -- in seconds

COMMENT ON COLUMN shows.average_runtime IS 'Average episode runtime in seconds (derived from TMDb episode runtimes)';