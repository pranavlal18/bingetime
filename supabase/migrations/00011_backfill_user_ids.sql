-- ─── BingeTime Migration: Backfill NULL user_ids ───
-- Run AFTER migration 00006. Creates a helper function that sets
-- user_id on rows that were imported before the auth migration was
-- applied (those rows have NULL user_id and are invisible to RLS).

-- 1. Create SECURITY DEFINER function to bypass RLS and backfill user_id
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
  -- Get the calling user's auth.uid
  uid := auth.uid();
  
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Count rows that need fixing
  SELECT COUNT(*) INTO shows_fixed FROM user_shows WHERE user_id IS NULL;
  SELECT COUNT(*) INTO movies_fixed FROM user_movies WHERE user_id IS NULL;
  SELECT COUNT(*) INTO episodes_fixed FROM user_episodes WHERE user_id IS NULL;

  -- Backfill user_shows
  UPDATE user_shows SET user_id = uid WHERE user_id IS NULL;
  
  -- Backfill user_movies
  UPDATE user_movies SET user_id = uid WHERE user_id IS NULL;
  
  -- Backfill user_episodes
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
