-- ─── BingeTime Consolidated Schema ───
-- Run once in Supabase SQL Editor. Idempotent (IF NOT EXISTS / DROP IF EXISTS).
-- Merges all 12 migration files into a single script.

-- ── Enable extensions ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Reference Tables ──
CREATE TABLE IF NOT EXISTS shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER,
  tvdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  poster_path TEXT,
  total_episodes INTEGER,
  last_air_date TEXT,
  average_runtime INTEGER,
  genres TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shows_tvdb_id ON shows (tvdb_id);
CREATE INDEX IF NOT EXISTS idx_shows_tmdb_id ON shows (tmdb_id);

CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  release_date TEXT,
  runtime INTEGER,
  poster_path TEXT,
  genres TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_title ON movies (title);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  item_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tmdb_cache (
  tvdb_id INTEGER PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('show', 'movie')),
  resolved_at TIMESTAMPTZ DEFAULT now()
);

-- ── User Data Tables ──
CREATE TABLE IF NOT EXISTS user_shows (
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  is_following BOOLEAN DEFAULT true,
  is_favorited BOOLEAN DEFAULT false,
  is_watchlist BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  episodes_seen INTEGER DEFAULT 0,
  last_watched_episode_data JSONB,
  favorited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (show_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_movies (
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMPTZ,
  is_watchlist BOOLEAN DEFAULT false,
  is_favorited BOOLEAN DEFAULT false,
  favorited_at TIMESTAMPTZ,
  rewatch_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (movie_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  watched BOOLEAN DEFAULT true,
  watched_at TIMESTAMPTZ,
  rewatch_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (show_id, season_number, episode_number, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_episodes_show ON user_episodes (show_id);
CREATE INDEX IF NOT EXISTS idx_user_shows_user_id ON user_shows (user_id);
CREATE INDEX IF NOT EXISTS idx_user_movies_user_id ON user_movies (user_id);
CREATE INDEX IF NOT EXISTS idx_user_episodes_user_id ON user_episodes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_shows_created_at ON user_shows (created_at);

-- ── Row Level Security ──
ALTER TABLE user_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tmdb_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_shows FORCE ROW LEVEL SECURITY;
ALTER TABLE user_movies FORCE ROW LEVEL SECURITY;
ALTER TABLE user_episodes FORCE ROW LEVEL SECURITY;

-- ── RLS Policies ──
-- User tables: users only see/modify their own rows
CREATE POLICY user_shows_select ON user_shows FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_shows_insert ON user_shows FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_shows_update ON user_shows FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_shows_delete ON user_shows FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY user_movies_select ON user_movies FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_movies_insert ON user_movies FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_movies_update ON user_movies FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_movies_delete ON user_movies FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY user_episodes_select ON user_episodes FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_insert ON user_episodes FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_update ON user_episodes FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_delete ON user_episodes FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Reference tables: readable by all authenticated users
CREATE POLICY shows_read ON shows FOR SELECT TO authenticated USING (true);
CREATE POLICY movies_read ON movies FOR SELECT TO authenticated USING (true);
CREATE POLICY lists_read ON lists FOR SELECT TO authenticated USING (true);
CREATE POLICY tmdb_cache_read ON tmdb_cache FOR SELECT TO authenticated USING (true);

-- Reference tables: authenticated users can insert/upsert (Discover → Add to Library)
CREATE POLICY shows_insert ON shows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY shows_upsert ON shows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY movies_insert ON movies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY movies_upsert ON movies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY lists_insert ON lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY lists_upsert ON lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tmdb_cache_insert ON tmdb_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tmdb_cache_upsert ON tmdb_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Grants ──
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_shows, user_movies, user_episodes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON shows, movies, lists, tmdb_cache TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── Updated At Triggers ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_shows_updated_at ON user_shows;
CREATE TRIGGER update_user_shows_updated_at BEFORE UPDATE ON user_shows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_movies_updated_at ON user_movies;
CREATE TRIGGER update_user_movies_updated_at BEFORE UPDATE ON user_movies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_episodes_updated_at ON user_episodes;
CREATE TRIGGER update_user_episodes_updated_at BEFORE UPDATE ON user_episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Backfill Helper (run once after enabling Auth) ──
-- Usage: SELECT backfill_user_ids();
CREATE OR REPLACE FUNCTION backfill_user_ids()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  result JSONB;
  shows_fixed INT;
  movies_fixed INT;
  episodes_fixed INT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT COUNT(*) INTO shows_fixed FROM user_shows WHERE user_id IS NULL;
  SELECT COUNT(*) INTO movies_fixed FROM user_movies WHERE user_id IS NULL;
  SELECT COUNT(*) INTO episodes_fixed FROM user_episodes WHERE user_id IS NULL;

  UPDATE user_shows SET user_id = uid WHERE user_id IS NULL;
  UPDATE user_movies SET user_id = uid WHERE user_id IS NULL;
  UPDATE user_episodes SET user_id = uid WHERE user_id IS NULL;

  result := jsonb_build_object(
    'success', true,
    'shows_fixed', shows_fixed,
    'movies_fixed', movies_fixed,
    'episodes_fixed', episodes_fixed
  );
  RETURN result;
END;
$$;