
-- 1. Newsletter subscribers: allow users to delete their own subscription
CREATE POLICY "Users can delete their own newsletter subscription"
ON public.newsletter_subscribers
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Daily usage: enforce user_id = auth.uid() on inserts by authenticated users
CREATE POLICY "Authenticated users insert their own daily_usage rows"
ON public.daily_usage
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. Strip long-lived signed URLs from commentator_overrides.portrait_url,
--    keeping only the storage object path. Short-lived signed URLs will be
--    generated server-side at request time.
UPDATE public.commentator_overrides
SET portrait_url = substring(portrait_url FROM '/object/sign/commentator-portraits/([^?]+)')
WHERE portrait_url LIKE '%/object/sign/commentator-portraits/%';

-- URL-decode the extracted path (simple replacement for %20 etc. is handled
-- in application code; paths are timestamped slugs with no special chars).
