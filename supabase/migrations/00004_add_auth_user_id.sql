-- ─── BingeTime Auth Migration ───
-- Add user_id to all user tables, enable RLS, create policies

-- 1. Clean slate (optional - run if you want to remove orphaned anonymous data)
TRUNCATE user_shows, user_episodes, user_movies RESTART IDENTITY CASCADE;

-- 2. Add user_id columns to user tables
ALTER TABLE user_shows ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE user_episodes ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE user_movies ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 3. Add updated_at columns for conflict resolution (sync)
ALTER TABLE user_shows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_movies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Create indexes for RLS performance (critical for security-rls-performance rule)
CREATE INDEX idx_user_shows_user_id ON user_shows (user_id);
CREATE INDEX idx_user_episodes_user_id ON user_episodes (user_id);
CREATE INDEX idx_user_movies_user_id ON user_movies (user_id);

-- 5. Enable Row Level Security on all user tables
ALTER TABLE user_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tmdb_cache ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (service_role)
ALTER TABLE user_shows FORCE ROW LEVEL SECURITY;
ALTER TABLE user_episodes FORCE ROW LEVEL SECURITY;
ALTER TABLE user_movies FORCE ROW LEVEL SECURITY;

-- 6. Create RLS policies using (select auth.uid()) pattern for performance
-- user_shows policies
CREATE POLICY user_shows_select ON user_shows FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_shows_insert ON user_shows FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_shows_update ON user_shows FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_shows_delete ON user_shows FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- user_episodes policies
CREATE POLICY user_episodes_select ON user_episodes FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_insert ON user_episodes FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_update ON user_episodes FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_delete ON user_episodes FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- user_movies policies
CREATE POLICY user_movies_select ON user_movies FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_movies_insert ON user_movies FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_movies_update ON user_movies FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_movies_delete ON user_movies FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- shows, movies, lists, tmdb_cache - readable by authenticated users (reference data)
CREATE POLICY shows_read ON shows FOR SELECT TO authenticated USING (true);
CREATE POLICY movies_read ON movies FOR SELECT TO authenticated USING (true);
CREATE POLICY lists_read ON lists FOR SELECT TO authenticated USING (true);
CREATE POLICY tmdb_cache_read ON tmdb_cache FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to INSERT/UPSERT into reference tables (for Discover -> Add to Library)
CREATE POLICY shows_insert ON shows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY shows_upsert ON shows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY movies_insert ON movies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY movies_upsert ON movies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY lists_insert ON lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY lists_upsert ON lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY tmdb_cache_insert ON tmdb_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tmdb_cache_upsert ON tmdb_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 7. Apply principle of least privilege (security-privileges rule)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_shows, user_episodes, user_movies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON shows, movies, lists, tmdb_cache TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 8. Create updated_at trigger function for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to user tables
DROP TRIGGER IF EXISTS update_user_shows_updated_at ON user_shows;
CREATE TRIGGER update_user_shows_updated_at BEFORE UPDATE ON user_shows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_episodes_updated_at ON user_episodes;
CREATE TRIGGER update_user_episodes_updated_at BEFORE UPDATE ON user_episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_movies_updated_at ON user_movies;
CREATE TRIGGER update_user_movies_updated_at BEFORE UPDATE ON user_movies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();