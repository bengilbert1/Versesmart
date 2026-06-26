-- 1) Remove any remaining base64 data URLs from the public commentator_overrides table.
-- The portrait upload flow now stores binaries in the private `commentator-portraits`
-- bucket and only persists a signed URL. Any legacy `data:` value here is large
-- binary payload shipped on every public SELECT.
UPDATE public.commentator_overrides
SET portrait_url = NULL
WHERE portrait_url LIKE 'data:%';

-- 2) RLS policies for the private `commentator-portraits` storage bucket.
-- RLS is already enabled on storage.objects by Supabase. Without explicit
-- policies, no role can access these objects through PostgREST/Storage API
-- except service_role (which bypasses RLS). We add minimal policies:
--   - authenticated users may read (SELECT) portraits
--   - writes (INSERT/UPDATE/DELETE) are reserved to service_role, which
--     bypasses RLS, so we intentionally add no policies for those ops.

DROP POLICY IF EXISTS "commentator_portraits_authenticated_read" ON storage.objects;
CREATE POLICY "commentator_portraits_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'commentator-portraits');
