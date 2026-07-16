-- ─── Add is_favorited to user_movies (matching existing user_shows.is_favorited) ───

ALTER TABLE user_movies ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT false;

-- Update RLS policies to handle the new column (existing policies already cover all columns)
-- No new policies needed — existing user_movies_update policy allows updating any column
-- where user_id matches auth.uid()
