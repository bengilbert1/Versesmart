ALTER TABLE public.votd_overrides
  ADD COLUMN IF NOT EXISTS guilt_innocence_summary text,
  ADD COLUMN IF NOT EXISTS shame_honour_summary text,
  ADD COLUMN IF NOT EXISTS fear_power_summary text;

ALTER TABLE public.votd_settings
  ADD COLUMN IF NOT EXISTS override_guilt_innocence text,
  ADD COLUMN IF NOT EXISTS override_shame_honour text,
  ADD COLUMN IF NOT EXISTS override_fear_power text;