
-- Lock down commentator_overrides: no public read access. All reads happen via server-side admin client / SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Public can read commentator overrides" ON public.commentator_overrides;
REVOKE SELECT ON public.commentator_overrides FROM anon, authenticated;
GRANT ALL ON public.commentator_overrides TO service_role;

-- Lock down commentator_lookup_history: service-role only (already RLS-enabled with no policies; make grants explicit).
REVOKE ALL ON public.commentator_lookup_history FROM anon, authenticated;
GRANT ALL ON public.commentator_lookup_history TO service_role;
