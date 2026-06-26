
-- Explicit restrictive deny so any future permissive policy still cannot expose rows to anon/authenticated.
CREATE POLICY "Deny all client access" ON public.commentator_lookup_history
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access" ON public.commentator_overrides
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
