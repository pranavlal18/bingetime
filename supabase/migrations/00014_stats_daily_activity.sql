-- ─── 00014: Daily activity RPC for stats ───
--
-- Replaces the client-side pattern of downloading EVERY watched episode row
-- (with runtime join) to bucket into weeks/months on the phone. The function
-- aggregates server-side and returns one row per watched day.
--
-- SECURITY INVOKER: runs with the caller's RLS, so a user can only ever
-- aggregate their own rows (user_episodes policy: user_id = auth.uid()).
-- The p_user_id argument must match the caller or zero rows are visible.

CREATE OR REPLACE FUNCTION get_daily_activity(p_user_id uuid)
RETURNS TABLE (
  day date,
  episode_count bigint,
  total_seconds bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    ue.watched_at::date AS day,
    count(*) AS episode_count,
    sum(COALESCE(s.average_runtime, 2520))::bigint AS total_seconds  -- 2520s = 42min fallback, matches client ESTIMATED_RUNTIME
  FROM user_episodes ue
  JOIN shows s ON s.id = ue.show_id
  WHERE ue.user_id = p_user_id
    AND ue.watched = true
    AND ue.watched_at IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_daily_activity(uuid) TO authenticated;
