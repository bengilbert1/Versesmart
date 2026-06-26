CREATE TABLE public.blog_post_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, language_code)
);

GRANT SELECT ON public.blog_post_translations TO anon, authenticated;
GRANT ALL ON public.blog_post_translations TO service_role;

ALTER TABLE public.blog_post_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read translations of published posts"
ON public.blog_post_translations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.blog_posts p
    WHERE p.id = blog_post_translations.post_id AND p.published = true
  )
);

CREATE INDEX blog_post_translations_post_lang_idx
  ON public.blog_post_translations (post_id, language_code);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_blog_post_translations_updated_at
BEFORE UPDATE ON public.blog_post_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();