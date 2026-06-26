
-- 1) Persistent usage counters on commentators
ALTER TABLE public.commentator_overrides
  ADD COLUMN IF NOT EXISTS usage_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_commentator_overrides_usage_count
  ON public.commentator_overrides (usage_count DESC);

-- RPC: increment usage_count for a roster (creates stub override rows for
-- any name not yet registered). Server-only access.
CREATE OR REPLACE FUNCTION public.increment_commentator_usage(p_names TEXT[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_key  TEXT;
BEGIN
  IF p_names IS NULL THEN RETURN; END IF;
  FOREACH v_name IN ARRAY p_names LOOP
    v_name := btrim(coalesce(v_name, ''));
    IF v_name = '' THEN CONTINUE; END IF;
    v_key := lower(regexp_replace(v_name, '[^a-z0-9]+', '', 'gi'));
    IF v_key = '' THEN CONTINUE; END IF;

    -- Ensure a stub row exists so the cumulative master list grows.
    INSERT INTO public.commentator_overrides (name_key, display_name)
      VALUES (v_key, v_name)
      ON CONFLICT (name_key, display_name) DO NOTHING;

    -- Bump every row with this name_key (covers multi-variant duplicates).
    UPDATE public.commentator_overrides
      SET usage_count = usage_count + 1,
          last_used_at = now()
      WHERE name_key = v_key;
  END LOOP;
END;
$$;

-- 2) User-by-country tracking
CREATE TABLE IF NOT EXISTS public.country_visits_total (
  country TEXT PRIMARY KEY,
  total BIGINT NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.country_visits_total TO authenticated;
GRANT ALL ON public.country_visits_total TO service_role;
ALTER TABLE public.country_visits_total ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny direct access country_visits_total" ON public.country_visits_total
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.country_visits_daily (
  country TEXT NOT NULL,
  day DATE NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (country, day)
);
CREATE INDEX IF NOT EXISTS idx_country_visits_daily_day
  ON public.country_visits_daily (day DESC);

GRANT SELECT ON public.country_visits_daily TO authenticated;
GRANT ALL ON public.country_visits_daily TO service_role;
ALTER TABLE public.country_visits_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny direct access country_visits_daily" ON public.country_visits_daily
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Dedupe table: one row per (client, day) — keeps daily counts honest.
CREATE TABLE IF NOT EXISTS public.country_visits_log (
  client_id UUID NOT NULL,
  day DATE NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, day)
);
CREATE INDEX IF NOT EXISTS idx_country_visits_log_day
  ON public.country_visits_log (day DESC);

GRANT SELECT ON public.country_visits_log TO authenticated;
GRANT ALL ON public.country_visits_log TO service_role;
ALTER TABLE public.country_visits_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny direct access country_visits_log" ON public.country_visits_log
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Lifetime-distinct client tracker per country (so persistent totals never
-- inflate when the same client returns).
CREATE TABLE IF NOT EXISTS public.country_client_first_seen (
  client_id UUID NOT NULL,
  country TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, country)
);
GRANT ALL ON public.country_client_first_seen TO service_role;
ALTER TABLE public.country_client_first_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny direct access country_client_first_seen" ON public.country_client_first_seen
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Record a visit. Idempotent per (client, day). Persistent totals only
-- increment the first time a given client is seen in a given country.
CREATE OR REPLACE FUNCTION public.record_country_visit(
  p_client_id UUID,
  p_country TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country TEXT;
  v_today DATE := (now() AT TIME ZONE 'UTC')::date;
  v_inserted_day BOOLEAN := false;
  v_inserted_lifetime BOOLEAN := false;
BEGIN
  IF p_client_id IS NULL THEN RETURN; END IF;
  v_country := upper(btrim(coalesce(p_country, '')));
  IF v_country = '' OR length(v_country) > 4 THEN RETURN; END IF;

  -- Daily dedupe
  INSERT INTO public.country_visits_log (client_id, day, country)
    VALUES (p_client_id, v_today, v_country)
    ON CONFLICT (client_id, day) DO NOTHING;
  GET DIAGNOSTICS v_inserted_day = ROW_COUNT;

  IF v_inserted_day THEN
    INSERT INTO public.country_visits_daily (country, day, count)
      VALUES (v_country, v_today, 1)
      ON CONFLICT (country, day) DO UPDATE
        SET count = public.country_visits_daily.count + 1;
  END IF;

  -- Lifetime dedupe per (client, country)
  INSERT INTO public.country_client_first_seen (client_id, country)
    VALUES (p_client_id, v_country)
    ON CONFLICT (client_id, country) DO NOTHING;
  GET DIAGNOSTICS v_inserted_lifetime = ROW_COUNT;

  IF v_inserted_lifetime THEN
    INSERT INTO public.country_visits_total (country, total)
      VALUES (v_country, 1)
      ON CONFLICT (country) DO UPDATE
        SET total = public.country_visits_total.total + 1,
            last_seen = now();
  ELSE
    UPDATE public.country_visits_total
      SET last_seen = now()
      WHERE country = v_country;
  END IF;

  -- Retention: prune daily counts older than 100 days; keep totals forever.
  DELETE FROM public.country_visits_daily WHERE day < v_today - 100;
  DELETE FROM public.country_visits_log WHERE day < v_today - 100;
END;
$$;

-- Admin RPCs: totals + 90-day daily breakdown.
CREATE OR REPLACE FUNCTION public.admin_country_totals()
RETURNS TABLE(country TEXT, total BIGINT, last_seen TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT country, total, last_seen
  FROM public.country_visits_total
  ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_country_daily(p_days INT DEFAULT 90)
RETURNS TABLE(country TEXT, day DATE, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT country, day, count
  FROM public.country_visits_daily
  WHERE day >= (now() AT TIME ZONE 'UTC')::date - GREATEST(p_days, 1)
  ORDER BY day ASC, country ASC;
$$;
