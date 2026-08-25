-- ─── 00013: Partial indexes + reference-table RLS guard ───
--
-- Non-destructive: no rows are read, modified, or deleted.
--
-- PRE-FLIGHT (run before this migration — expect 0):
--   SELECT count(*) FROM shows  WHERE tmdb_id IS NULL;
--   SELECT count(*) FROM movies WHERE tmdb_id IS NULL;
-- If any rows have NULL tmdb_id they stay readable (USING true) but can no
-- longer be UPDATED until their tmdb_id is set. The app re-upserts them with
-- a valid tmdb_id on next Discover → Add to Library.

-- ── 1. Partial composite indexes for the app's hot queries ──
-- Every query filters user_id + a boolean flag; these store ONLY matching
-- rows so list/stats lookups skip non-matching data entirely.

CREATE INDEX IF NOT EXISTS idx_user_shows_watchlist
  ON user_shows (user_id) WHERE is_watchlist = true;

CREATE INDEX IF NOT EXISTS idx_user_movies_watchlist
  ON user_movies (user_id) WHERE is_watchlist = true;

-- watched_at DESC matches the stats monthly/streaks ordering
CREATE INDEX IF NOT EXISTS idx_user_episodes_watched
  ON user_episodes (user_id, watched_at DESC) WHERE watched = true;

-- ── 2. Reference tables: block null-poisoning writes ──
-- Previously WITH CHECK (true): any authenticated client (the anon key is
-- public in the app bundle) could overwrite shared shows/movies rows with
-- garbage. The app only ever upserts valid TMDb data (tmdb_id always set),
-- so this guard keeps Discover → Add to Library working while rejecting
-- null/garbage writes.
-- lists / tmdb_cache policies intentionally left as-is.

DROP POLICY IF EXISTS shows_insert ON shows;
CREATE POLICY shows_insert ON shows FOR INSERT TO authenticated
  WITH CHECK (tmdb_id IS NOT NULL);

DROP POLICY IF EXISTS shows_upsert ON shows;
CREATE POLICY shows_upsert ON shows FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (tmdb_id IS NOT NULL);

DROP POLICY IF EXISTS movies_insert ON movies;
CREATE POLICY movies_insert ON movies FOR INSERT TO authenticated
  WITH CHECK (tmdb_id IS NOT NULL);

DROP POLICY IF EXISTS movies_upsert ON movies;
CREATE POLICY movies_upsert ON movies FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (tmdb_id IS NOT NULL);
