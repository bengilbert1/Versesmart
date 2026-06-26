CREATE TABLE public.verse_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  reference text NOT NULL,
  translation text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, translation)
);

ALTER TABLE public.verse_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read verse cache"
  ON public.verse_cache FOR SELECT
  USING (true);

CREATE INDEX verse_cache_slug_idx ON public.verse_cache (slug);