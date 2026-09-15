-- HealthGenie Supabase/PostgreSQL schema
-- Anonymous sign-in must be enabled in Supabase Authentication settings.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  merchant_id text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.merchants (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 100),
  accepting_orders boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.products (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  merchant_id text not null,
  name text not null check (char_length(name) between 1 and 100),
  price numeric(12, 2) not null default 0 check (price >= 0),
  available boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, merchant_id) references public.merchants(owner_id, id) on delete cascade
);

create table if not exists public.orders (
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null,
  client_request_id text not null,
  merchant_id text not null,
  status text not null check (status in (
    'pending', 'preparing', 'waiting_delivery', 'delivering',
    'completed', 'cancelled', 'rejected'
  )),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, order_id),
  unique (owner_id, client_request_id),
  foreign key (owner_id, merchant_id) references public.merchants(owner_id, id)
);

create table if not exists public.analytics_events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  event_type text not null check (event_type in (
    'view_menu', 'click_meal', 'add_to_cart', 'checkout',
    'order_created', 'navigate_store'
  )),
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  primary key (owner_id, event_id)
);

create index if not exists products_owner_merchant_idx on public.products(owner_id, merchant_id);
create index if not exists orders_owner_merchant_created_idx on public.orders(owner_id, merchant_id, created_at desc);
create index if not exists orders_owner_status_idx on public.orders(owner_id, status);
create index if not exists analytics_owner_occurred_idx on public.analytics_events(owner_id, occurred_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at before update on public.carts
for each row execute function public.set_updated_at();
drop trigger if exists merchants_set_updated_at on public.merchants;
create trigger merchants_set_updated_at before update on public.merchants
for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.carts enable row level security;
alter table public.merchants enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists profiles_owner_access on public.profiles;
create policy profiles_owner_access on public.profiles for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists carts_owner_access on public.carts;
create policy carts_owner_access on public.carts for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists merchants_owner_access on public.merchants;
create policy merchants_owner_access on public.merchants for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists products_owner_access on public.products;
create policy products_owner_access on public.products for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists orders_owner_access on public.orders;
create policy orders_owner_access on public.orders for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists analytics_owner_access on public.analytics_events;
create policy analytics_owner_access on public.analytics_events for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.carts,
  public.merchants,
  public.products,
  public.orders,
  public.analytics_events
to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'carts', 'merchants', 'products', 'orders', 'analytics_events']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

