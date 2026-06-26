CREATE TABLE public.commentator_lookup_history (
  scope_key TEXT NOT NULL PRIMARY KEY,
  last_authors TEXT[] NOT NULL DEFAULT '{}',
  ever_used TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.commentator_lookup_history TO service_role;
ALTER TABLE public.commentator_lookup_history ENABLE ROW LEVEL SECURITY;
-- No client policies: only the server (service_role) reads/writes this table.