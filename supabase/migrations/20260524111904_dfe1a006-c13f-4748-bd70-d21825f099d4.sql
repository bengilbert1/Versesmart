ALTER TABLE public.bonus_lookups DROP CONSTRAINT IF EXISTS bonus_lookups_user_id_key;
CREATE INDEX IF NOT EXISTS bonus_lookups_user_used_at_idx ON public.bonus_lookups (user_id, used_at DESC);