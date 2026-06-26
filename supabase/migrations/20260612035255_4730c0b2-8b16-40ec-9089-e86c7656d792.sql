
CREATE TABLE public.votd_overrides (
  day_of_year INT PRIMARY KEY CHECK (day_of_year BETWEEN 1 AND 365),
  reference TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.votd_overrides TO service_role;
ALTER TABLE public.votd_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.votd_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.votd_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  override_reference TEXT,
  override_excerpt TEXT,
  override_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.votd_settings TO service_role;
ALTER TABLE public.votd_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.votd_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.votd_settings (id, enabled) VALUES (1, true) ON CONFLICT DO NOTHING;
