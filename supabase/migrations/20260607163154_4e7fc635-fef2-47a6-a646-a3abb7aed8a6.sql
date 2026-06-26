
-- Aggregated verse-search counts
create table if not exists public.analytics_verse_searches (
  reference_key text primary key,
  count bigint not null default 0,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
grant select, insert, update on public.analytics_verse_searches to anon, authenticated;
grant all on public.analytics_verse_searches to service_role;
alter table public.analytics_verse_searches enable row level security;
-- No policies = no direct table access; writes go through SECURITY DEFINER RPCs below.

-- Aggregated theme-search counts (free-text queries typed into Explore)
create table if not exists public.analytics_theme_searches (
  theme_key text primary key,
  count bigint not null default 0,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
grant select, insert, update on public.analytics_theme_searches to anon, authenticated;
grant all on public.analytics_theme_searches to service_role;
alter table public.analytics_theme_searches enable row level security;

-- Aggregated section-open counts: type ∈ ('worldview','theme','author','differ','agree','disagree','historical_group')
create table if not exists public.analytics_section_opens (
  section_type text not null,
  section_key  text not null,
  count bigint not null default 0,
  last_seen timestamptz not null default now(),
  primary key (section_type, section_key)
);
grant select, insert, update on public.analytics_section_opens to anon, authenticated;
grant all on public.analytics_section_opens to service_role;
alter table public.analytics_section_opens enable row level security;

-- Daily total search volume
create table if not exists public.analytics_daily_searches (
  day date primary key,
  count bigint not null default 0
);
grant select, insert, update on public.analytics_daily_searches to anon, authenticated;
grant all on public.analytics_daily_searches to service_role;
alter table public.analytics_daily_searches enable row level security;

-- Atomic increment RPCs. SECURITY DEFINER so RLS-protected tables can be written
-- without granting direct table access. Inputs are length-clamped and trimmed.

create or replace function public.track_verse_search(p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := lower(btrim(coalesce(p_reference, '')));
  if v_key = '' or length(v_key) > 200 then return; end if;

  insert into public.analytics_verse_searches (reference_key, count, first_seen, last_seen)
    values (v_key, 1, now(), now())
  on conflict (reference_key) do update
    set count = public.analytics_verse_searches.count + 1,
        last_seen = now();

  insert into public.analytics_daily_searches (day, count)
    values (current_date, 1)
  on conflict (day) do update
    set count = public.analytics_daily_searches.count + 1;
end;
$$;
revoke execute on function public.track_verse_search(text) from public;
grant execute on function public.track_verse_search(text) to anon, authenticated;

create or replace function public.track_theme_search(p_query text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := lower(btrim(coalesce(p_query, '')));
  if v_key = '' or length(v_key) > 200 then return; end if;

  insert into public.analytics_theme_searches (theme_key, count, first_seen, last_seen)
    values (v_key, 1, now(), now())
  on conflict (theme_key) do update
    set count = public.analytics_theme_searches.count + 1,
        last_seen = now();
end;
$$;
revoke execute on function public.track_theme_search(text) from public;
grant execute on function public.track_theme_search(text) to anon, authenticated;

create or replace function public.track_section_open(p_type text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key  text;
begin
  v_type := lower(btrim(coalesce(p_type, '')));
  v_key  := btrim(coalesce(p_key, ''));
  if v_type = '' or v_key = '' then return; end if;
  if length(v_type) > 40 or length(v_key) > 200 then return; end if;
  if v_type !~ '^[a-z0-9_]+$' then return; end if;

  insert into public.analytics_section_opens (section_type, section_key, count, last_seen)
    values (v_type, v_key, 1, now())
  on conflict (section_type, section_key) do update
    set count = public.analytics_section_opens.count + 1,
        last_seen = now();
end;
$$;
revoke execute on function public.track_section_open(text, text) from public;
grant execute on function public.track_section_open(text, text) to anon, authenticated;
