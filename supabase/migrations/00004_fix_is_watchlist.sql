-- ─── Fix is_watchlist for existing imported data ───
-- The import pipeline previously didn't set is_watchlist = true for imported
-- shows/movies, so all existing user_shows/user_movies rows have the DB default of false.
-- Now that the Shows/Movies tabs filter by is_watchlist, these items were invisible.

UPDATE user_shows SET is_watchlist = true WHERE is_watchlist = false OR is_watchlist IS NULL;
UPDATE user_movies SET is_watchlist = true WHERE is_watchlist = false OR is_watchlist IS NULL;
