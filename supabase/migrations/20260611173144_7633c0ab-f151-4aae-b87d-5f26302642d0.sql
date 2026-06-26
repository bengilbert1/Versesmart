
-- All functions are SECURITY DEFINER and only return aggregated counts.
-- They are revoked from anon/authenticated and only callable by service_role
-- via the admin server function.

CREATE OR REPLACE FUNCTION public.admin_search_heatmap()
RETURNS TABLE(dow int, hour int, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM created_at)::int AS dow,
    EXTRACT(HOUR FROM created_at)::int AS hour,
    COUNT(*)::bigint AS count
  FROM public.daily_usage
  WHERE created_at >= now() - interval '30 days'
  GROUP BY 1, 2
$$;

CREATE OR REPLACE FUNCTION public.admin_retention_curve()
RETURNS TABLE(day_offset int, retained bigint, cohort_size bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  d int;
BEGIN
  FOR d IN SELECT unnest(ARRAY[1, 7, 30]) LOOP
    RETURN QUERY
    WITH cohort AS (
      SELECT u.id, u.created_at::date AS signup_date
      FROM auth.users u
      WHERE u.created_at <= now() - (d || ' days')::interval
    ),
    activity AS (
      SELECT DISTINCT du.user_id, du.usage_date
      FROM public.daily_usage du
      WHERE du.user_id IS NOT NULL
    )
    SELECT
      d,
      COUNT(DISTINCT c.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM activity a
          WHERE a.user_id = c.id
            AND a.usage_date = c.signup_date + d
        )
      )::bigint,
      COUNT(*)::bigint
    FROM cohort c;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_searches_by_tier()
RETURNS TABLE(tier text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_subs AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      CASE
        WHEN price_id IN ('plus_monthly','pro_monthly') THEN 'explore'
        WHEN price_id IN ('basic_monthly','unlimited_monthly','unlimited_yearly') THEN 'engage'
        ELSE 'free'
      END AS tier
    FROM public.subscriptions
    WHERE status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
    ORDER BY user_id, created_at DESC
  ),
  tagged AS (
    SELECT
      CASE
        WHEN du.user_id IS NULL THEN 'anonymous'
        ELSE COALESCE(s.tier, 'free')
      END AS tier
    FROM public.daily_usage du
    LEFT JOIN active_subs s ON s.user_id = du.user_id
    WHERE du.created_at >= now() - interval '30 days'
  )
  SELECT tier, COUNT(*)::bigint
  FROM tagged
  GROUP BY tier
$$;

CREATE OR REPLACE FUNCTION public.admin_funnel()
RETURNS TABLE(stage text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'anonymous'::text,
    COUNT(DISTINCT client_id)::bigint
  FROM public.daily_usage
  WHERE user_id IS NULL
    AND created_at >= now() - interval '30 days'
  UNION ALL
  SELECT 'free_signup',
    (SELECT COUNT(*)::bigint FROM auth.users)
  UNION ALL
  SELECT 'engage',
    (SELECT COUNT(DISTINCT user_id)::bigint
     FROM public.subscriptions
     WHERE price_id IN ('basic_monthly','unlimited_monthly','unlimited_yearly')
       AND status IN ('active','trialing')
       AND (current_period_end IS NULL OR current_period_end > now()))
  UNION ALL
  SELECT 'explore',
    (SELECT COUNT(DISTINCT user_id)::bigint
     FROM public.subscriptions
     WHERE price_id IN ('plus_monthly','pro_monthly')
       AND status IN ('active','trialing')
       AND (current_period_end IS NULL OR current_period_end > now()))
$$;

CREATE OR REPLACE FUNCTION public.admin_feature_usage()
RETURNS TABLE(feature text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Search'::text,
    COALESCE((SELECT SUM(count) FROM public.analytics_verse_searches), 0)::bigint
  UNION ALL
  SELECT 'Explore',
    COALESCE((SELECT SUM(count) FROM public.analytics_theme_searches), 0)::bigint
  UNION ALL
  SELECT 'Compare',
    COALESCE((SELECT SUM(count) FROM public.analytics_section_opens
              WHERE section_type IN ('agree','differ','disagree')), 0)::bigint
  UNION ALL
  SELECT 'Saved History',
    COALESCE((SELECT COUNT(*) FROM public.search_history), 0)::bigint
  UNION ALL
  SELECT 'Worldviews',
    COALESCE((SELECT SUM(count) FROM public.analytics_section_opens
              WHERE section_type = 'worldview'), 0)::bigint
$$;

REVOKE ALL ON FUNCTION public.admin_search_heatmap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_retention_curve() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_searches_by_tier() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_funnel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_feature_usage() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_search_heatmap() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_retention_curve() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_searches_by_tier() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_feature_usage() TO service_role;
