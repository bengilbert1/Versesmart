
-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- has_active_subscription helper
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status in ('canceled','past_due') and current_period_end > now())
    )
  );
$$;

-- Daily usage (anonymous + signed in)
create table public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  reference_key text not null,
  created_at timestamptz default now(),
  unique (client_id, usage_date, reference_key)
);
create index idx_daily_usage_lookup on public.daily_usage(client_id, usage_date);

alter table public.daily_usage enable row level security;

-- Public access (no PII) — server function writes via service role anyway, but allow
-- direct reads for client-side count too.
create policy "Anyone can read daily_usage"
  on public.daily_usage for select using (true);
create policy "Anyone can insert daily_usage"
  on public.daily_usage for insert with check (true);

-- Realtime for subscriptions
alter publication supabase_realtime add table public.subscriptions;
