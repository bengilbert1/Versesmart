CREATE TABLE IF NOT EXISTS public.ai_cache (
  cache_key text PRIMARY KEY,
  fn_name text NOT NULL,
  payload jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  hit_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ai_cache_fn_name_idx ON public.ai_cache (fn_name);
CREATE INDEX IF NOT EXISTS ai_cache_expires_at_idx ON public.ai_cache (expires_at);

GRANT ALL ON public.ai_cache TO service_role;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (which bypasses RLS) may access this table.