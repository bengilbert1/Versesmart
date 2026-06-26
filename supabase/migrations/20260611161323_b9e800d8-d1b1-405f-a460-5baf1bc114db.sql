
DROP POLICY IF EXISTS "otp_codes_no_client_access" ON public.otp_codes;
CREATE POLICY "otp_codes_no_client_access"
  ON public.otp_codes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "testers_no_client_writes" ON public.testers;
CREATE POLICY "testers_no_client_writes"
  ON public.testers
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (false);
