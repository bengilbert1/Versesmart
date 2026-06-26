CREATE TABLE public.commentator_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.commentator_blocks TO anon, authenticated;
GRANT ALL ON public.commentator_blocks TO service_role;

ALTER TABLE public.commentator_blocks ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) may read the blocked list so the
-- client can hide blocked commentators consistently. Writes are restricted
-- to the service role and gated by the admin email check inside the
-- server function that performs them.
CREATE POLICY "Anyone can read commentator blocks"
  ON public.commentator_blocks
  FOR SELECT
  USING (true);