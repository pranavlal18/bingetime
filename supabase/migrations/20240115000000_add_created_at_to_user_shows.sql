-- Add created_at column to user_shows table
-- This tracks when a show was first added to the user's library/watchlist
-- Used for 21-day "Haven't Watched" threshold for never-watched shows

ALTER TABLE user_shows 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows: use updated_at as fallback
UPDATE user_shows 
SET created_at = updated_at 
WHERE created_at IS NULL;

-- Add index for potential queries on created_at
CREATE INDEX IF NOT EXISTS idx_user_shows_created_at ON user_shows (created_at);
