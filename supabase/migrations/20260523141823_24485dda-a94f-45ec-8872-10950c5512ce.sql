-- 1. Remove public read on daily_usage; service role policy already allows server access.
DROP POLICY IF EXISTS "Anyone can read daily_usage" ON public.daily_usage;

-- 2. Remove subscriptions table from realtime publication (not used by app).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions';
  END IF;
END $$;