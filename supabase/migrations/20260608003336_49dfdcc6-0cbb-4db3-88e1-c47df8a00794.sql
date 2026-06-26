
-- Revoke EXECUTE from anon/authenticated on server-only SECURITY DEFINER functions.
-- These are meant to be called only from server code (service_role) or as triggers.

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trim_search_history() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_user_signup() FROM anon, authenticated, public;

-- Tracking RPCs are intentionally callable by anon + authenticated; ensure that stays.
GRANT EXECUTE ON FUNCTION public.track_verse_search(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_theme_search(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_section_open(text, text) TO anon, authenticated;
