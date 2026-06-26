CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_codes_email_created_idx ON public.otp_codes (email, created_at DESC);
CREATE INDEX otp_codes_expires_idx ON public.otp_codes (expires_at);

GRANT ALL ON public.otp_codes TO service_role;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: this table is only ever touched by service_role
-- via server functions. Clients never query it directly.