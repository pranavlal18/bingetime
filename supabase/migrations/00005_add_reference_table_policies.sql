-- ─── BingeTime Auth Migration - Part 2 ───
-- Add missing INSERT/UPSERT policies for reference tables (shows, movies, lists, tmdb_cache)

-- 1. Add INSERT/UPSERT policies for reference tables (for Discover -> Add to Library)
-- Drop first (migration 00004 may have created them already), then recreate
-- shows
DROP POLICY IF EXISTS shows_insert ON shows;
CREATE POLICY shows_insert ON shows FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS shows_upsert ON shows;
CREATE POLICY shows_upsert ON shows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- movies
DROP POLICY IF EXISTS movies_insert ON movies;
CREATE POLICY movies_insert ON movies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS movies_upsert ON movies;
CREATE POLICY movies_upsert ON movies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- lists
DROP POLICY IF EXISTS lists_insert ON lists;
CREATE POLICY lists_insert ON lists FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS lists_upsert ON lists;
CREATE POLICY lists_upsert ON lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- tmdb_cache
DROP POLICY IF EXISTS tmdb_cache_insert ON tmdb_cache;
CREATE POLICY tmdb_cache_insert ON tmdb_cache FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS tmdb_cache_upsert ON tmdb_cache;
CREATE POLICY tmdb_cache_upsert ON tmdb_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Update grants to include INSERT/UPDATE on reference tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_shows, user_episodes, user_movies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON shows, movies, lists, tmdb_cache TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;