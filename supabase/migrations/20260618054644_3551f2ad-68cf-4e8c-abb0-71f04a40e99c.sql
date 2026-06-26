CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule with the same name to keep this idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('daily-votd-make-webhook');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-votd-make-webhook',
  '0 6 * * *', -- every day at 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://versesmart.org/api/public/hooks/daily-votd-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ2t6d255Y25ob3hvZ2xpdWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNDQ0NjksImV4cCI6MjA5NDYyMDQ2OX0.r6rg6VpWXaHPcl-dCAQY216rcqF-XnaN8M6fdTuj9fg'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);