
CREATE OR REPLACE FUNCTION public.normalize_commentator_name(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT trim(regexp_replace(
           regexp_replace(lower(coalesce(p, '')), '[.,''’"·\-_/\\]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

ALTER TABLE public.commentator_overrides
  DROP CONSTRAINT IF EXISTS commentator_overrides_name_key_display_name_key;

UPDATE public.commentator_overrides
   SET name_key = public.normalize_commentator_name(display_name)
 WHERE name_key IS DISTINCT FROM public.normalize_commentator_name(display_name);

DROP TABLE IF EXISTS _canon;
CREATE TEMP TABLE _canon AS
SELECT DISTINCT ON (name_key) id, name_key
  FROM public.commentator_overrides
 ORDER BY name_key,
          is_primary DESC,
          (portrait_url IS NOT NULL) DESC,
          updated_at DESC NULLS LAST,
          created_at ASC;

DROP TABLE IF EXISTS _agg;
CREATE TEMP TABLE _agg AS
SELECT
  name_key,
  bool_or(is_manual) AS any_manual,
  COALESCE(SUM(usage_count), 0)::bigint AS sum_usage,
  MAX(last_used_at) AS max_last_used,
  (array_agg(portrait_url    ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE portrait_url    IS NOT NULL))[1] AS best_portrait,
  (array_agg(region          ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE region          IS NOT NULL))[1] AS best_region,
  (array_agg(denomination    ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE denomination    IS NOT NULL))[1] AS best_denomination,
  (array_agg(country         ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE country         IS NOT NULL))[1] AS best_country,
  (array_agg(tradition       ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE tradition       IS NOT NULL))[1] AS best_tradition,
  (array_agg(worldview       ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE worldview       IS NOT NULL))[1] AS best_worldview,
  (array_agg(gender          ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE gender          IS NOT NULL))[1] AS best_gender,
  (array_agg(publication_era ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE publication_era IS NOT NULL))[1] AS best_pub_era,
  (array_agg(birth_year      ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE birth_year      IS NOT NULL))[1] AS best_birth,
  (array_agg(death_year      ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE death_year      IS NOT NULL))[1] AS best_death
FROM public.commentator_overrides
GROUP BY name_key;

UPDATE public.commentator_overrides co
   SET portrait_url    = COALESCE(co.portrait_url,    a.best_portrait),
       region          = COALESCE(co.region,          a.best_region),
       denomination    = COALESCE(co.denomination,    a.best_denomination),
       country         = COALESCE(co.country,         a.best_country),
       tradition       = COALESCE(co.tradition,       a.best_tradition),
       worldview       = COALESCE(co.worldview,       a.best_worldview),
       gender          = COALESCE(co.gender,          a.best_gender),
       publication_era = COALESCE(co.publication_era, a.best_pub_era),
       birth_year      = COALESCE(co.birth_year,      a.best_birth),
       death_year      = COALESCE(co.death_year,      a.best_death),
       is_manual       = a.any_manual,
       is_hidden       = false,
       is_primary      = true,
       usage_count     = a.sum_usage,
       last_used_at    = a.max_last_used,
       updated_at      = now()
  FROM _canon c
  JOIN _agg a USING (name_key)
 WHERE co.id = c.id;

DELETE FROM public.commentator_overrides
 WHERE id NOT IN (SELECT id FROM _canon);

ALTER TABLE public.commentator_overrides
  ADD CONSTRAINT commentator_overrides_name_key_unique UNIQUE (name_key);

CREATE OR REPLACE FUNCTION public.increment_commentator_usage(p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name TEXT;
  v_key  TEXT;
BEGIN
  IF p_names IS NULL THEN RETURN; END IF;
  FOREACH v_name IN ARRAY p_names LOOP
    v_name := btrim(coalesce(v_name, ''));
    IF v_name = '' THEN CONTINUE; END IF;
    v_key := public.normalize_commentator_name(v_name);
    IF v_key = '' THEN CONTINUE; END IF;

    INSERT INTO public.commentator_overrides (name_key, display_name, is_primary, usage_count, last_used_at)
      VALUES (v_key, v_name, true, 1, now())
      ON CONFLICT (name_key) DO UPDATE
        SET usage_count = public.commentator_overrides.usage_count + 1,
            last_used_at = now();
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.commentator_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'cron',
  duplicates_found int NOT NULL DEFAULT 0,
  duplicates_merged int NOT NULL DEFAULT 0,
  orphaned_removed int NOT NULL DEFAULT 0,
  missing_portraits int NOT NULL DEFAULT 0,
  manual_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text
);

GRANT ALL ON public.commentator_audit_log TO service_role;
ALTER TABLE public.commentator_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny client access" ON public.commentator_audit_log;
CREATE POLICY "Deny client access"
  ON public.commentator_audit_log
  AS RESTRICTIVE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS commentator_audit_log_ran_at_idx
  ON public.commentator_audit_log (ran_at DESC);

CREATE OR REPLACE FUNCTION public.admin_commentator_audit(p_source text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dup_found int := 0;
  v_dup_merged int := 0;
  v_orphans int := 0;
  v_missing_portraits int := 0;
  v_log_id uuid;
  v_manual jsonb := '[]'::jsonb;
BEGIN
  UPDATE public.commentator_overrides
     SET name_key = public.normalize_commentator_name(display_name)
   WHERE name_key IS DISTINCT FROM public.normalize_commentator_name(display_name);

  SELECT COUNT(*) - COUNT(DISTINCT name_key) INTO v_dup_found
    FROM public.commentator_overrides;

  IF v_dup_found > 0 THEN
    DROP TABLE IF EXISTS _audit_canon;
    CREATE TEMP TABLE _audit_canon AS
    SELECT DISTINCT ON (name_key) id, name_key
      FROM public.commentator_overrides
     ORDER BY name_key, is_primary DESC, (portrait_url IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at ASC;

    DROP TABLE IF EXISTS _audit_agg;
    CREATE TEMP TABLE _audit_agg AS
    SELECT name_key,
           bool_or(is_manual) AS any_manual,
           COALESCE(SUM(usage_count), 0)::bigint AS sum_usage,
           MAX(last_used_at) AS max_last_used,
           (array_agg(portrait_url ORDER BY updated_at DESC NULLS LAST) FILTER (WHERE portrait_url IS NOT NULL))[1] AS best_portrait
      FROM public.commentator_overrides
     GROUP BY name_key;

    UPDATE public.commentator_overrides co
       SET portrait_url = COALESCE(co.portrait_url, a.best_portrait),
           is_manual    = a.any_manual,
           is_primary   = true,
           usage_count  = a.sum_usage,
           last_used_at = a.max_last_used,
           updated_at   = now()
      FROM _audit_canon c
      JOIN _audit_agg a USING (name_key)
     WHERE co.id = c.id;

    WITH del AS (
      DELETE FROM public.commentator_overrides
       WHERE id NOT IN (SELECT id FROM _audit_canon)
       RETURNING 1
    )
    SELECT COUNT(*) INTO v_dup_merged FROM del;
  END IF;

  WITH del AS (
    DELETE FROM public.commentator_overrides
     WHERE name_key IN (SELECT name_key FROM public.deleted_commentators)
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphans FROM del;

  SELECT COUNT(*) INTO v_missing_portraits
    FROM public.commentator_overrides
   WHERE portrait_url IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', 'missing_portrait',
           'name_key', name_key,
           'display_name', display_name,
           'recommendation', 'Upload a portrait in the admin panel.'
         )), '[]'::jsonb)
    INTO v_manual
    FROM (
      SELECT name_key, display_name
        FROM public.commentator_overrides
       WHERE portrait_url IS NULL
       ORDER BY usage_count DESC, display_name ASC
       LIMIT 50
    ) s;

  INSERT INTO public.commentator_audit_log (
    source, duplicates_found, duplicates_merged, orphaned_removed,
    missing_portraits, manual_issues, notes
  ) VALUES (
    COALESCE(p_source, 'manual'),
    v_dup_found, v_dup_merged, v_orphans,
    v_missing_portraits, v_manual,
    NULL
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_commentator_audit(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_commentator_audit(text) TO service_role;
