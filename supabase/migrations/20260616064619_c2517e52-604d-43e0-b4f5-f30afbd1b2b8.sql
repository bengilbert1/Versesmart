
-- 1) commentator_blocks: remove public read; backend (service_role) reads via supabaseAdmin.
DROP POLICY IF EXISTS "Anyone can read commentator blocks" ON public.commentator_blocks;
REVOKE SELECT ON public.commentator_blocks FROM anon, authenticated;

CREATE POLICY "Deny direct reads on commentator_blocks"
  ON public.commentator_blocks
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) Analytics tables: document deny-by-default for direct table access.
--    Writes happen through SECURITY DEFINER RPCs (track_* / admin_*).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'analytics_daily_searches',
      'analytics_section_opens',
      'analytics_theme_searches',
      'analytics_verse_searches'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Deny direct access" ON public.%I', t
    );
    EXECUTE format(
      'CREATE POLICY "Deny direct access" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format(
      'REVOKE ALL ON public.%I FROM anon, authenticated', t
    );
  END LOOP;
END$$;
