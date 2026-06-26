
-- 1. Add new metadata columns to commentator_overrides
ALTER TABLE public.commentator_overrides
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS publication_era text,
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS death_year integer;

-- 2. Category extension table (admin-added category values)
CREATE TABLE IF NOT EXISTS public.commentator_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type text NOT NULL,
  value text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_type, value)
);

GRANT SELECT ON public.commentator_categories TO anon, authenticated;
GRANT ALL ON public.commentator_categories TO service_role;

ALTER TABLE public.commentator_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read commentator categories"
  ON public.commentator_categories FOR SELECT
  USING (true);
