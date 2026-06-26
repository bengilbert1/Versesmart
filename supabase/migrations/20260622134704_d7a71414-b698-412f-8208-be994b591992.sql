
CREATE TABLE public.admin_commentator_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_key TEXT NOT NULL,
  sort_index INTEGER,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, name_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_commentator_prefs TO authenticated;
GRANT ALL ON public.admin_commentator_prefs TO service_role;

ALTER TABLE public.admin_commentator_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin prefs self read"
  ON public.admin_commentator_prefs FOR SELECT
  TO authenticated USING (auth.uid() = admin_user_id);

CREATE POLICY "admin prefs self write"
  ON public.admin_commentator_prefs FOR ALL
  TO authenticated USING (auth.uid() = admin_user_id)
  WITH CHECK (auth.uid() = admin_user_id);

CREATE INDEX idx_admin_prefs_user ON public.admin_commentator_prefs(admin_user_id);

CREATE TRIGGER admin_commentator_prefs_touch_updated_at
  BEFORE UPDATE ON public.admin_commentator_prefs
  FOR EACH ROW EXECUTE FUNCTION public.commentator_overrides_touch_updated_at();
