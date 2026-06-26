
CREATE TABLE public.deleted_commentators (
  name_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.deleted_commentators TO service_role;
ALTER TABLE public.deleted_commentators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all to anon authenticated"
  ON public.deleted_commentators
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
