
CREATE TABLE public.commentator_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key text NOT NULL,
  display_name text NOT NULL,
  region text,
  denomination text,
  country text,
  tradition text,
  worldview text,
  is_primary boolean NOT NULL DEFAULT false,
  is_manual boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_key, display_name)
);

CREATE INDEX commentator_overrides_name_key_idx ON public.commentator_overrides (name_key);

GRANT SELECT ON public.commentator_overrides TO anon, authenticated;
GRANT ALL ON public.commentator_overrides TO service_role;

ALTER TABLE public.commentator_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read commentator overrides"
  ON public.commentator_overrides FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.commentator_overrides_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commentator_overrides_touch_updated_at
  BEFORE UPDATE ON public.commentator_overrides
  FOR EACH ROW EXECUTE FUNCTION public.commentator_overrides_touch_updated_at();
