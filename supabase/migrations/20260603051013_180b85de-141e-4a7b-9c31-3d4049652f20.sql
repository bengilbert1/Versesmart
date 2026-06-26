-- Bible verses table — schema only. Seeding 6 public-domain translations (~150k verses each) is a separate bulk import job.
CREATE TABLE public.bible_verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_code text NOT NULL,
  book text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (translation_code, book, chapter, verse)
);

CREATE INDEX idx_bible_verses_lookup ON public.bible_verses (translation_code, book, chapter, verse);

GRANT SELECT ON public.bible_verses TO anon;
GRANT SELECT ON public.bible_verses TO authenticated;
GRANT ALL ON public.bible_verses TO service_role;

ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;

-- Bible text is public domain; readable by everyone.
CREATE POLICY "Bible verses are publicly readable"
  ON public.bible_verses
  FOR SELECT
  USING (true);