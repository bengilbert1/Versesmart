
REVOKE EXECUTE ON FUNCTION public.increment_commentator_usage(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_country_visit(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_country_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_country_daily(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_commentator_usage(TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_country_visit(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_country_totals() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_country_daily(INT) TO service_role;
