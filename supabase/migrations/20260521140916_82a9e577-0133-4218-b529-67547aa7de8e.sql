
CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_usage_user_month_idx
  ON public.ai_chat_usage (user_id, environment, created_at DESC);

ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat usage"
  ON public.ai_chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages chat usage"
  ON public.ai_chat_usage FOR ALL
  USING (auth.role() = 'service_role');
