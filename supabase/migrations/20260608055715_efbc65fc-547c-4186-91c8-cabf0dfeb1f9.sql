CREATE OR REPLACE FUNCTION public.trim_search_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
begin
  delete from public.search_history
  where user_id = new.user_id
    and id not in (
      select id from public.search_history
      where user_id = new.user_id
      order by created_at desc
      limit 100
    );
  return null;
end;
$function$;