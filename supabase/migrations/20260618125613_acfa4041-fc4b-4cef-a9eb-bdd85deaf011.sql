-- 1) Remove unused authenticated INSERT policy on daily_usage.
-- All inserts in the app go through service_role (admin client); allowing
-- authenticated INSERT lets clients write arbitrary client_id values.
DROP POLICY IF EXISTS "Authenticated users insert their own daily_usage rows" ON public.daily_usage;

-- 2) Lock down storage.objects for the private commentator-portraits bucket.
-- The app reads/writes via service_role and serves short-lived signed URLs,
-- so no direct authenticated or anon access is needed.
DROP POLICY IF EXISTS "commentator_portraits_service_role_all" ON storage.objects;
DROP POLICY IF EXISTS "commentator_portraits_block_anon" ON storage.objects;
DROP POLICY IF EXISTS "commentator_portraits_block_authenticated" ON storage.objects;

CREATE POLICY "commentator_portraits_service_role_all"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'commentator-portraits' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'commentator-portraits' AND auth.role() = 'service_role');

CREATE POLICY "commentator_portraits_block_anon"
  ON storage.objects
  FOR ALL
  TO anon
  USING (bucket_id <> 'commentator-portraits')
  WITH CHECK (bucket_id <> 'commentator-portraits');

CREATE POLICY "commentator_portraits_block_authenticated"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id <> 'commentator-portraits')
  WITH CHECK (bucket_id <> 'commentator-portraits');