create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reference text not null,
  translation text not null,
  created_at timestamptz not null default now()
);

create index search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;

create policy "Users can view own history"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own history"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own history"
  on public.search_history for delete
  using (auth.uid() = user_id);

create policy "Service role manages history"
  on public.search_history for all
  using (auth.role() = 'service_role');

-- Trim to most recent 50 per user after each insert
create or replace function public.trim_search_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.search_history
  where user_id = new.user_id
    and id not in (
      select id from public.search_history
      where user_id = new.user_id
      order by created_at desc
      limit 50
    );
  return null;
end;
$$;

create trigger search_history_trim
after insert on public.search_history
for each row execute function public.trim_search_history();