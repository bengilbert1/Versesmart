CREATE TABLE public.testers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_tester BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.testers TO authenticated;
GRANT ALL ON public.testers TO service_role;

ALTER TABLE public.testers ENABLE ROW LEVEL SECURITY;

-- Users can see only their own tester row (admin reads go through service_role).
CREATE POLICY "Users can view own tester row"
  ON public.testers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX testers_user_id_idx ON public.testers(user_id);
CREATE INDEX testers_expires_at_idx ON public.testers(expires_at);

CREATE OR REPLACE FUNCTION public.update_testers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_testers_updated_at
  BEFORE UPDATE ON public.testers
  FOR EACH ROW EXECUTE FUNCTION public.update_testers_updated_at();