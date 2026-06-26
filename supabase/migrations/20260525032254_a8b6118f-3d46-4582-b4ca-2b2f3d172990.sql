CREATE POLICY "Only service role can read feedback"
ON public.feedback
FOR SELECT
TO anon, authenticated
USING (false);