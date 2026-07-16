-- ─── Add favorited_at timestamp to user_shows and user_movies ───

ALTER TABLE user_shows  ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMPTZ;
ALTER TABLE user_movies ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMPTZ;
