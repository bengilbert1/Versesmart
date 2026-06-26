
-- daily_usage: deny anonymous role any access (service role + authenticated own rows remain via existing permissive policies)
CREATE POLICY "Deny anon access to daily_usage"
  ON public.daily_usage
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- email_unsubscribe_tokens: deny all client roles; only service_role may touch it
CREATE POLICY "Deny client access to email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- suppressed_emails: deny all client roles; only service_role may touch it
CREATE POLICY "Deny client access to suppressed_emails"
  ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
