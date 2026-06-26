
CREATE TABLE public.bonus_lookups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  reference TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonus" ON public.bonus_lookups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages bonus" ON public.bonus_lookups
  FOR ALL USING (auth.role() = 'service_role');
