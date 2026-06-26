
CREATE TABLE public.auth_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup','signin')),
  method TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_event_log_created_at_idx ON public.auth_event_log (created_at DESC);
CREATE INDEX auth_event_log_event_type_idx ON public.auth_event_log (event_type, created_at DESC);

GRANT INSERT ON public.auth_event_log TO authenticated;
GRANT ALL ON public.auth_event_log TO service_role;

ALTER TABLE public.auth_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own auth events"
  ON public.auth_event_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
