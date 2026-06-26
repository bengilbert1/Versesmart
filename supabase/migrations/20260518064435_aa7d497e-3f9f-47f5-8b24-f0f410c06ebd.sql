
drop policy "Anyone can insert daily_usage" on public.daily_usage;

create policy "Service role can manage daily_usage"
  on public.daily_usage for all
  using (auth.role() = 'service_role');

revoke execute on function public.has_active_subscription(uuid, text) from anon, authenticated;
