-- ─── BingeTime Initial Schema ───
-- Run this in the Supabase SQL editor to set up all tables.

-- ── Shows ──
CREATE TABLE IF NOT EXISTS shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER,
  tvdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  poster_path TEXT,
  total_episodes INTEGER,
  last_air_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shows_tvdb_id ON shows (tvdb_id);
CREATE INDEX IF NOT EXISTS idx_shows_tmdb_id ON shows (tmdb_id);

-- ── User Shows (per-show tracking data) ──
CREATE TABLE IF NOT EXISTS user_shows (
  show_id UUID PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  is_following BOOLEAN DEFAULT true,
  is_favorited BOOLEAN DEFAULT false,
  is_watchlist BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  episodes_seen INTEGER DEFAULT 0,
  last_watched_episode_data JSONB, -- {episode_id, season_number, episode_number, watched_at}
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Episode Watch Events (from tracking-prod-records-v2.csv) ──
-- Uses (show_id, season_number, episode_number) as natural key
CREATE TABLE IF NOT EXISTS user_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  watched BOOLEAN DEFAULT true,
  watched_at TIMESTAMPTZ,
  rewatch_count INTEGER DEFAULT 0,
  UNIQUE(show_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_user_episodes_show ON user_episodes (show_id);

-- ── Movies ──
CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER,
  title TEXT NOT NULL,
  release_date TEXT,
  runtime INTEGER, -- in seconds
  poster_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_title ON movies (title);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies (tmdb_id);

-- ── User Movies (per-movie tracking data) ──
CREATE TABLE IF NOT EXISTS user_movies (
  movie_id UUID PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMPTZ,
  is_watchlist BOOLEAN DEFAULT false,
  rewatch_count INTEGER DEFAULT 0
);

-- ── Custom Lists (imported silently, no UI until Phase 8) ──
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY, -- TV Time internal uuid
  name TEXT NOT NULL,
  description TEXT,
  item_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── TMDb Resolution Cache ──
-- Prevents re-resolving shows/movies that already have TMDb IDs
CREATE TABLE IF NOT EXISTS tmdb_cache (
  tvdb_id INTEGER PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('show', 'movie')),
  resolved_at TIMESTAMPTZ DEFAULT now()
);
