-- ─── BingeTime Auth Migration - Part 3 ───
-- Fix primary keys/constraints for multi-user support
-- user_shows, user_movies, user_episodes need composite keys with user_id

-- 1. Drop existing primary keys and recreate with composite (id, user_id)
-- user_shows: change PK from show_id to (show_id, user_id)
ALTER TABLE user_shows DROP CONSTRAINT IF EXISTS user_shows_pkey;
ALTER TABLE user_shows ADD PRIMARY KEY (show_id, user_id);
-- user_movies: change PK from movie_id to (movie_id, user_id)
ALTER TABLE user_movies DROP CONSTRAINT IF EXISTS user_movies_pkey;
ALTER TABLE user_movies ADD PRIMARY KEY (movie_id, user_id);

-- 2. user_episodes: add user_id and update unique constraint
ALTER TABLE user_episodes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_user_episodes_user_id ON user_episodes (user_id);

-- Drop old unique constraint and add new one with user_id
ALTER TABLE user_episodes DROP CONSTRAINT IF EXISTS user_episodes_show_id_season_number_episode_number_key;
ALTER TABLE user_episodes ADD CONSTRAINT user_episodes_unique 
  UNIQUE (show_id, season_number, episode_number, user_id);

-- 3. Add updated_at to user_episodes if not exists
ALTER TABLE user_episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Create RLS policies for user_episodes (if not already)
ALTER TABLE user_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_episodes FORCE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_episodes_select ON user_episodes;
DROP POLICY IF EXISTS user_episodes_insert ON user_episodes;
DROP POLICY IF EXISTS user_episodes_update ON user_episodes;
DROP POLICY IF EXISTS user_episodes_delete ON user_episodes;

CREATE POLICY user_episodes_select ON user_episodes FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_insert ON user_episodes FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_update ON user_episodes FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_episodes_delete ON user_episodes FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_episodes TO authenticated;

-- 6. Add updated_at trigger for user_episodes
DROP TRIGGER IF EXISTS update_user_episodes_updated_at ON user_episodes;
CREATE TRIGGER update_user_episodes_updated_at BEFORE UPDATE ON user_episodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();