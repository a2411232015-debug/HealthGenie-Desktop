-- =====================================================================
-- HealthGenie 點餐平台 v1
--
-- 這個版本把原本「每個人只看得到自己資料」的示範架構，改成真正多人使用的平台：
--   * 顧客、商家、平台管理員三種身分
--   * 所有顧客都看得到「已審核通過」店家的菜單
--   * 店家看得到下給自己的訂單，顧客只看得到自己的訂單
--   * 下單一律由資料庫函式 place_order() 重新計算價格，前端無法竄改金額
--   * 訂單狀態只能透過 update_order_status() 依規則變更
--
-- 舊版示範資料表（有 payload 欄位的那一版）不會被刪除，而是改名為 legacy_*。
-- 確認不需要後，可以在 SQL Editor 自行執行 drop table public.legacy_xxx。
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. 保留舊版示範資料表（改名，不刪除）
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  idx record;
begin
  foreach t in array array['analytics_events', 'orders', 'products', 'carts', 'merchants', 'profiles']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'payload'
    ) then
      if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', t);
      end if;
      for idx in
        select indexname from pg_indexes where schemaname = 'public' and tablename = t
      loop
        execute format('alter index public.%I rename to %I', idx.indexname, 'legacy_' || idx.indexname);
      end loop;
      execute format('alter table public.%I rename to %I', t, 'legacy_' || t);
    end if;
  end loop;
end $$;

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

-- 判斷這次請求是否來自一般登入使用者（從 SQL Editor 或 service role 執行時為 false）
create or replace function public.is_end_user_request()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------------
-- 1. 使用者資料
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 50),
  phone text not null default '' check (char_length(phone) <= 20),
  default_address text not null default '' check (char_length(default_address) <= 200),
  -- 健康資料：gender, age, height, weight, targetWeight, activityLevel
  health jsonb not null default '{}'::jsonb check (jsonb_typeof(health) = 'object'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- 已註冊的正式會員（排除 Supabase 匿名登入產生的臨時帳號）
create or replace function public.is_registered_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is not null and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 新註冊的帳號自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      ''
    ), 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 已存在的帳號補建 profile
insert into public.profiles (id, display_name)
select u.id, left(coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), ''), 50)
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. 營業時間與規格驗證
-- ---------------------------------------------------------------------
-- opening_hours 格式：[{ "day": 0-6（0=週日）, "open": "11:00", "close": "20:30" }, ...]
-- close 小於等於 open 代表跨夜（例如 18:00–02:00）。
create or replace function public.valid_opening_hours(p_hours jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_entry jsonb;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 21 then
    return false;
  end if;
  for v_entry in select value from jsonb_array_elements(p_hours)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or jsonb_typeof(v_entry -> 'day') <> 'number'
      or (v_entry ->> 'day') !~ '^[0-6]$'
      or coalesce(v_entry ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_entry ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (v_entry ->> 'open') = (v_entry ->> 'close')
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.is_open_at(p_hours jsonb, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Taipei';
  v_dow int := extract(dow from v_local)::int;
  v_time time := v_local::time;
  v_entry jsonb;
  v_day int;
  v_open time;
  v_close time;
begin
  if not public.valid_opening_hours(p_hours) then
    return false;
  end if;
  for v_entry in select value from jsonb_array_elements(p_hours)
  loop
    v_day := (v_entry ->> 'day')::int;
    v_open := (v_entry ->> 'open')::time;
    v_close := (v_entry ->> 'close')::time;
    if v_close > v_open then
      if v_day = v_dow and v_time >= v_open and v_time < v_close then
        return true;
      end if;
    else
      -- 跨夜時段
      if (v_day = v_dow and v_time >= v_open)
        or (v_day = (v_dow + 6) % 7 and v_time < v_close) then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;

-- option_groups 格式沿用前端：
-- [{ id, name, type: single|multiple, required, minSelect, maxSelect,
--    options: [{ id, name, priceDelta, caloriesDelta, proteinDelta, fatDelta,
--                carbsDelta, fiberDelta, sodiumDelta, available }] }]
create or replace function public.valid_option_groups(p_groups jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_group jsonb;
  v_option jsonb;
  v_option_ids text[] := '{}';
  v_group_ids text[] := '{}';
  v_count int;
  v_min int;
  v_max int;
begin
  if p_groups is null or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) > 20 then
    return false;
  end if;
  for v_group in select value from jsonb_array_elements(p_groups)
  loop
    if jsonb_typeof(v_group) <> 'object'
      or coalesce(v_group ->> 'id', '') = ''
      or char_length(coalesce(btrim(v_group ->> 'name'), '')) not between 1 and 30
      or coalesce(v_group ->> 'type', '') not in ('single', 'multiple')
      or jsonb_typeof(v_group -> 'options') <> 'array'
    then
      return false;
    end if;
    if (v_group ? 'required' and jsonb_typeof(v_group -> 'required') <> 'boolean') then
      return false;
    end if;
    if (v_group ->> 'id') = any(v_group_ids) then
      return false;
    end if;
    v_group_ids := v_group_ids || (v_group ->> 'id');
    v_count := jsonb_array_length(v_group -> 'options');
    if v_count < 1 or v_count > 30 then
      return false;
    end if;
    if coalesce(v_group ->> 'minSelect', '0') !~ '^[0-9]+$'
      or coalesce(v_group ->> 'maxSelect', '1') !~ '^[0-9]+$' then
      return false;
    end if;
    v_min := coalesce((v_group ->> 'minSelect')::int, 0);
    v_max := coalesce((v_group ->> 'maxSelect')::int, 1);
    if v_max < 1 or v_min > v_max or v_max > v_count then
      return false;
    end if;
    for v_option in select value from jsonb_array_elements(v_group -> 'options')
    loop
      if jsonb_typeof(v_option) <> 'object'
        or coalesce(v_option ->> 'id', '') = ''
        or char_length(coalesce(btrim(v_option ->> 'name'), '')) not between 1 and 30
        or coalesce(v_option ->> 'priceDelta', '0') !~ '^-?[0-9]+$'
        or abs(coalesce(v_option ->> 'priceDelta', '0')::numeric) > 10000
      then
        return false;
      end if;
      if (v_option ? 'available' and jsonb_typeof(v_option -> 'available') <> 'boolean')
        or exists (
          select 1 from unnest(array['caloriesDelta', 'proteinDelta', 'fatDelta', 'carbsDelta', 'fiberDelta', 'sodiumDelta']) as k
          where v_option ? k and (
            jsonb_typeof(v_option -> k) <> 'number' or abs((v_option ->> k)::numeric) > 100000
          )
        )
      then
        return false;
      end if;
      if (v_option ->> 'id') = any(v_option_ids) then
        return false;
      end if;
      v_option_ids := v_option_ids || (v_option ->> 'id');
    end loop;
  end loop;
  return true;
end;
$$;

-- nutrition 格式：{ calories, protein, fat, carbs, fiber, sodium, sugar }，皆為 0 以上的數字，可省略
create or replace function public.valid_nutrition(p_nutrition jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_nutrition is not null
    and jsonb_typeof(p_nutrition) = 'object'
    and not exists (
      select 1 from jsonb_each(p_nutrition) as e(key, value)
      where e.key not in ('calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'sugar')
        or (jsonb_typeof(e.value) <> 'null' and (
          jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric not between 0 and 100000
        ))
    );
$$;

-- ---------------------------------------------------------------------
-- 3. 店家
-- ---------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 50),
  description text not null default '' check (char_length(description) <= 300),
  phone text not null check (char_length(phone) between 6 and 20),
  address text not null check (char_length(btrim(address)) between 5 and 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  cover_image_url text not null default '' check (char_length(cover_image_url) <= 1000),
  opening_hours jsonb not null default '[]'::jsonb check (public.valid_opening_hours(opening_hours)),
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_fee integer not null default 0 check (delivery_fee between 0 and 1000),
  service_fee integer not null default 0 check (service_fee between 0 and 1000),
  discount integer not null default 0 check (discount between 0 and 1000),
  min_order_amount integer not null default 0 check (min_order_amount between 0 and 100000),
  prep_minutes integer not null default 20 check (prep_minutes between 5 and 180),
  accepting_orders boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text not null default '' check (char_length(review_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_enabled or delivery_enabled)
);

create index merchants_status_idx on public.merchants(status);

create trigger merchants_set_updated_at before update on public.merchants
for each row execute function public.set_updated_at();

-- 一般使用者不能自己改審核狀態；被退件的店家修改資料後會重新送審
create or replace function public.guard_merchant_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.review_note := '';
  else
    if new.owner_id <> old.owner_id then
      raise exception '不可變更店家擁有者';
    end if;
    new.status := case when old.status = 'rejected' then 'pending' else old.status end;
    new.review_note := old.review_note;
  end if;
  return new;
end;
$$;

create trigger merchants_guard before insert or update on public.merchants
for each row execute function public.guard_merchant_changes();

-- ---------------------------------------------------------------------
-- 4. 餐點
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  description text not null default '' check (char_length(description) <= 300),
  category text not null default '' check (char_length(category) <= 30),
  price integer not null check (price between 0 and 100000),
  image_url text not null default '' check (char_length(image_url) <= 1000),
  -- 營養標示：calories, protein, fat, carbs, fiber, sodium, sugar（未提供可省略）
  nutrition jsonb not null default '{}'::jsonb check (public.valid_nutrition(nutrition)),
  allergens text[] not null default '{}' check (cardinality(allergens) <= 20),
  option_groups jsonb not null default '[]'::jsonb check (public.valid_option_groups(option_groups)),
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_merchant_idx on public.products(merchant_id, sort_order, created_at);

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. 訂單
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  -- 會員刪除帳號後設為 null，訂單金額紀錄保留給店家對帳
  customer_id uuid references public.profiles(id) on delete set null,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  client_request_id text not null check (char_length(client_request_id) between 8 and 100),
  status text not null default 'pending' check (status in (
    'pending', 'preparing', 'ready', 'delivering', 'completed', 'cancelled', 'rejected'
  )),
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  item_count integer not null check (item_count > 0),
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  service_fee integer not null default 0 check (service_fee >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null check (total >= 0),
  merchant_name text not null,
  merchant_phone text not null,
  merchant_address text not null,
  contact_name text not null,
  contact_phone text not null,
  delivery_address text not null default '',
  note text not null default '' check (char_length(note) <= 200),
  payment_method text not null default 'cash' check (payment_method in ('cash')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  estimated_ready_at timestamptz,
  -- 預約取餐／送達時間；null 代表盡快
  scheduled_for timestamptz,
  status_history jsonb not null default '[]'::jsonb,
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (customer_id, client_request_id),
  unique (merchant_id, order_number)
);

create index orders_merchant_created_idx on public.orders(merchant_id, created_at desc);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_merchant_status_idx on public.orders(merchant_id, status);

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- 每間店每天的流水號（取餐號碼）
create table public.order_counters (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  day date not null,
  last_number integer not null default 0,
  primary key (merchant_id, day)
);

-- 計算單一品項（價格、規格、營養），下單與測試共用
create or replace function public.compute_order_item(
  p_product public.products,
  p_option_ids text[],
  p_quantity integer,
  p_remark text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_group jsonb;
  v_option jsonb;
  v_selected text[] := coalesce(p_option_ids, '{}');
  v_group_count int;
  v_matched int := 0;
  v_min int;
  v_max int;
  v_option_price int := 0;
  v_unit_price int;
  v_snapshots jsonb := '[]'::jsonb;
  v_has_nutrition boolean := (p_product.nutrition ->> 'calories') is not null;
  v_nutrition jsonb;
  v_keys text[] := array['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'sugar'];
  v_totals numeric[] := array[0, 0, 0, 0, 0, 0, 0];
  v_remark text := btrim(coalesce(p_remark, ''));
  i int;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then
    raise exception '「%」數量需介於 1 到 50', p_product.name;
  end if;
  if char_length(v_remark) > 100 then
    raise exception '「%」的備註最多 100 字', p_product.name;
  end if;
  if cardinality(v_selected) <> (select count(distinct x) from unnest(v_selected) as x) then
    raise exception '「%」的選項重複', p_product.name;
  end if;

  if v_has_nutrition then
    for i in 1..array_length(v_keys, 1) loop
      v_totals[i] := coalesce((p_product.nutrition ->> v_keys[i])::numeric, 0);
    end loop;
  end if;

  for v_group in select value from jsonb_array_elements(p_product.option_groups)
  loop
    v_group_count := 0;
    for v_option in select value from jsonb_array_elements(v_group -> 'options')
    loop
      if (v_option ->> 'id') = any(v_selected) then
        if not coalesce((v_option ->> 'available')::boolean, true) then
          raise exception '「%」的選項「%」已停售', p_product.name, v_option ->> 'name';
        end if;
        v_group_count := v_group_count + 1;
        v_matched := v_matched + 1;
        v_option_price := v_option_price + coalesce((v_option ->> 'priceDelta')::int, 0);
        v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
          'groupId', v_group ->> 'id',
          'groupName', v_group ->> 'name',
          'optionId', v_option ->> 'id',
          'name', v_option ->> 'name',
          'priceDelta', coalesce((v_option ->> 'priceDelta')::int, 0)
        ));
        if v_has_nutrition then
          v_totals[1] := v_totals[1] + coalesce((v_option ->> 'caloriesDelta')::numeric, 0);
          v_totals[2] := v_totals[2] + coalesce((v_option ->> 'proteinDelta')::numeric, 0);
          v_totals[3] := v_totals[3] + coalesce((v_option ->> 'fatDelta')::numeric, 0);
          v_totals[4] := v_totals[4] + coalesce((v_option ->> 'carbsDelta')::numeric, 0);
          v_totals[5] := v_totals[5] + coalesce((v_option ->> 'fiberDelta')::numeric, 0);
          v_totals[6] := v_totals[6] + coalesce((v_option ->> 'sodiumDelta')::numeric, 0);
        end if;
      end if;
    end loop;

    v_min := greatest(
      coalesce((v_group ->> 'minSelect')::int, 0),
      case when coalesce((v_group ->> 'required')::boolean, false) then 1 else 0 end
    );
    v_max := case when v_group ->> 'type' = 'single' then 1 else coalesce((v_group ->> 'maxSelect')::int, 1) end;
    if v_group_count < v_min then
      raise exception '「%」請選擇%', p_product.name, v_group ->> 'name';
    end if;
    if v_group_count > v_max then
      raise exception '「%」的%最多選擇 % 項', p_product.name, v_group ->> 'name', v_max;
    end if;
  end loop;

  if v_matched <> cardinality(v_selected) then
    raise exception '「%」的選項已更新，請重新選擇', p_product.name;
  end if;

  v_unit_price := p_product.price + v_option_price;
  if v_unit_price < 0 then
    raise exception '「%」的價格設定有誤', p_product.name;
  end if;

  if v_has_nutrition then
    v_nutrition := '{}'::jsonb;
    for i in 1..array_length(v_keys, 1) loop
      v_nutrition := v_nutrition || jsonb_build_object(v_keys[i], greatest(0, round(v_totals[i], 1)));
    end loop;
  end if;

  return jsonb_build_object(
    'productId', p_product.id,
    'name', p_product.name,
    'imageUrl', p_product.image_url,
    'quantity', p_quantity,
    'basePrice', p_product.price,
    'optionPrice', v_option_price,
    'unitPrice', v_unit_price,
    'subtotal', v_unit_price * p_quantity,
    'options', v_snapshots,
    'remark', v_remark,
    'unitNutrition', v_nutrition
  );
end;
$$;

create or replace function public.place_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_fulfillment text,
  p_contact_name text,
  p_contact_phone text,
  p_delivery_address text,
  p_note text,
  p_client_request_id text,
  p_expected_total integer default null,
  p_scheduled_for timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_merchant public.merchants;
  v_product public.products;
  v_entry jsonb;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_item_count int := 0;
  v_delivery_fee int;
  v_discount int;
  v_total int;
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_number int;
  v_phone text := regexp_replace(coalesce(p_contact_phone, ''), '[\s-]', '', 'g');
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_address text := btrim(coalesce(p_delivery_address, ''));
  v_note text := btrim(coalesce(p_note, ''));
  v_product_id uuid;
  v_quantity int;
  v_option_ids text[];
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '請先登入會員再下單' using errcode = '28000';
  end if;
  if coalesce(p_client_request_id, '') = '' then
    raise exception '缺少訂單識別碼';
  end if;

  -- 重複送出（例如連點、網路重送）時直接回傳同一張訂單
  select * into v_order from public.orders
  where customer_id = v_uid and client_request_id = p_client_request_id;
  if found then
    return v_order;
  end if;

  select * into v_merchant from public.merchants where id = p_merchant_id for share;
  if not found or v_merchant.status <> 'approved' then
    raise exception '找不到這間店家，或店家尚未開放';
  end if;
  if not v_merchant.accepting_orders then
    raise exception '店家目前暫停接單';
  end if;
  if p_scheduled_for is null then
    if not public.is_open_at(v_merchant.opening_hours, now()) then
      raise exception '店家目前不在營業時間，可以改用預約';
    end if;
  else
    if p_scheduled_for < now() + make_interval(mins => v_merchant.prep_minutes) - interval '2 minutes' then
      raise exception '預約時間太早，店家需要約 % 分鐘準備', v_merchant.prep_minutes;
    end if;
    if p_scheduled_for > now() + interval '2 days' then
      raise exception '最多只能預約兩天內的時間';
    end if;
    if not public.is_open_at(v_merchant.opening_hours, p_scheduled_for) then
      raise exception '預約的時間店家沒有營業';
    end if;
  end if;

  if p_fulfillment = 'pickup' then
    if not v_merchant.pickup_enabled then
      raise exception '這間店目前不提供自取';
    end if;
  elsif p_fulfillment = 'delivery' then
    if not v_merchant.delivery_enabled then
      raise exception '這間店目前不提供外送';
    end if;
    if char_length(v_address) not between 5 and 200 then
      raise exception '請填寫完整的外送地址';
    end if;
  else
    raise exception '取餐方式不正確';
  end if;

  if char_length(v_name) not between 1 and 30 then
    raise exception '請填寫訂購人姓名（30 字以內）';
  end if;
  if v_phone !~ '^(09[0-9]{8}|0[2-8][0-9]{6,8})$' then
    raise exception '請填寫正確的聯絡電話';
  end if;
  if char_length(v_note) > 200 then
    raise exception '訂單備註最多 200 字';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception '購物車內容不正確';
  end if;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_entry ->> 'productId')::uuid;
      v_quantity := (v_entry ->> 'quantity')::int;
      v_option_ids := array(select jsonb_array_elements_text(coalesce(v_entry -> 'optionIds', '[]'::jsonb)));
    exception when others then
      raise exception '購物車內容不正確';
    end;

    select * into v_product from public.products
    where id = v_product_id and merchant_id = p_merchant_id;
    if not found then
      raise exception '購物車內有餐點已下架，請回購物車移除';
    end if;
    if not v_product.available then
      raise exception '「%」已售完，請回購物車移除', v_product.name;
    end if;

    v_line := public.compute_order_item(v_product, v_option_ids, v_quantity, v_entry ->> 'remark');
    v_lines := v_lines || jsonb_build_array(v_line);
    v_subtotal := v_subtotal + (v_line ->> 'subtotal')::int;
    v_item_count := v_item_count + v_quantity;
  end loop;

  if v_subtotal < v_merchant.min_order_amount then
    raise exception '未達最低訂購金額 NT$%', v_merchant.min_order_amount;
  end if;

  v_delivery_fee := case when p_fulfillment = 'delivery' then v_merchant.delivery_fee else 0 end;
  v_discount := least(v_merchant.discount, v_subtotal + v_delivery_fee + v_merchant.service_fee);
  v_total := v_subtotal + v_delivery_fee + v_merchant.service_fee - v_discount;

  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception '價格已更新為 NT$%，請確認後再送出', v_total using errcode = 'HG001';
  end if;

  begin
    insert into public.order_counters as c (merchant_id, day, last_number)
    values (p_merchant_id, v_day, 1)
    on conflict (merchant_id, day) do update set last_number = c.last_number + 1
    returning last_number into v_number;

    insert into public.orders (
      order_number, customer_id, merchant_id, client_request_id, status, fulfillment,
      items, item_count, subtotal, delivery_fee, service_fee, discount, total,
      merchant_name, merchant_phone, merchant_address,
      contact_name, contact_phone, delivery_address, note,
      estimated_ready_at, scheduled_for, status_history
    ) values (
      to_char(v_day, 'YYMMDD') || '-' || lpad(v_number::text, 4, '0'),
      v_uid, p_merchant_id, p_client_request_id, 'pending', p_fulfillment,
      v_lines, v_item_count, v_subtotal, v_delivery_fee, v_merchant.service_fee, v_discount, v_total,
      v_merchant.name, v_merchant.phone, v_merchant.address,
      v_name, v_phone, case when p_fulfillment = 'delivery' then v_address else '' end, v_note,
      coalesce(p_scheduled_for, now() + make_interval(mins => v_merchant.prep_minutes)),
      p_scheduled_for,
      jsonb_build_array(jsonb_build_object('status', 'pending', 'at', now()))
    )
    returning * into v_order;
  exception when unique_violation then
    select * into v_order from public.orders
    where customer_id = v_uid and client_request_id = p_client_request_id;
    if not found then
      raise;
    end if;
  end;

  return v_order;
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_reason text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_prep int;
  v_is_merchant boolean;
  v_is_customer boolean;
  v_allowed boolean := false;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception '請先登入' using errcode = '28000';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception '找不到這張訂單';
  end if;

  select m.prep_minutes, (m.owner_id = v_uid) or public.is_admin()
  into v_prep, v_is_merchant
  from public.merchants m where m.id = v_order.merchant_id;
  v_is_customer := v_order.customer_id = v_uid;

  if not v_is_merchant and not v_is_customer then
    raise exception '找不到這張訂單';
  end if;

  if v_is_merchant then
    v_allowed := (v_order.status, p_status) in (
      ('pending', 'preparing'),
      ('pending', 'rejected'),
      ('preparing', 'ready'),
      ('preparing', 'cancelled'),
      ('ready', 'completed'),
      ('ready', 'cancelled'),
      ('delivering', 'completed')
    ) or (v_order.status = 'ready' and p_status = 'delivering' and v_order.fulfillment = 'delivery');
  end if;
  if not v_allowed and v_is_customer then
    v_allowed := v_order.status = 'pending' and p_status = 'cancelled';
    if v_allowed and v_reason = '' then
      v_reason := '顧客取消訂單';
    end if;
  end if;

  if not v_allowed then
    if v_is_customer and not v_is_merchant and p_status = 'cancelled' then
      raise exception '店家已開始處理，無法自行取消，請直接致電店家';
    end if;
    raise exception '訂單目前的狀態無法改為這個狀態';
  end if;

  if p_status in ('rejected', 'cancelled') and v_reason = '' then
    raise exception '請填寫原因，讓顧客知道發生了什麼事';
  end if;
  if char_length(v_reason) > 200 then
    raise exception '原因最多 200 字';
  end if;

  update public.orders set
    status = p_status,
    cancel_reason = case when p_status in ('rejected', 'cancelled') then v_reason else cancel_reason end,
    estimated_ready_at = case when p_status = 'preparing' then greatest(coalesce(scheduled_for, now()), now() + make_interval(mins => v_prep)) else estimated_ready_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    payment_status = case when p_status = 'completed' then 'paid' else payment_status end,
    status_history = status_history || jsonb_build_array(jsonb_build_object('status', p_status, 'at', now()))
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- 5b. 刪除帳號（個資法：會員可以要求刪除個人資料）
-- ---------------------------------------------------------------------
-- 由 account Edge Function 以會員本人身分呼叫，清除個人資料後，再由函式刪除登入帳號。
-- 過去訂單的金額保留給店家對帳，但姓名、電話、地址會被清除。
create or replace function public.prepare_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '請先登入' using errcode = '28000';
  end if;
  if exists (select 1 from public.merchants where owner_id = v_uid) then
    raise exception '你有經營中的店家，請先聯絡平台管理員關閉店家後再刪除帳號';
  end if;
  if exists (
    select 1 from public.orders
    where customer_id = v_uid and status in ('pending', 'preparing', 'ready', 'delivering')
  ) then
    raise exception '你還有進行中的訂單，請等訂單完成或取消後再刪除帳號';
  end if;

  update public.orders set
    contact_name = '已刪除的會員',
    contact_phone = '',
    delivery_address = case when delivery_address = '' then '' else '（已刪除）' end,
    note = ''
  where customer_id = v_uid;
  delete from public.food_logs where user_id = v_uid;
  delete from public.weight_logs where user_id = v_uid;
  delete from public.ai_usage where user_id = v_uid;
  update public.profiles
  set display_name = '', phone = '', default_address = '', health = '{}'::jsonb
  where id = v_uid;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. 健康紀錄
-- ---------------------------------------------------------------------
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  calories integer not null check (calories between 0 and 10000),
  protein numeric(6, 1) check (protein between 0 and 1000),
  fat numeric(6, 1) check (fat between 0 and 1000),
  carbs numeric(6, 1) check (carbs between 0 and 1000),
  source text not null default 'manual' check (source in ('manual', 'order', 'photo')),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index food_logs_user_eaten_idx on public.food_logs(user_id, eaten_at desc);
create unique index food_logs_user_order_idx on public.food_logs(user_id, order_id) where order_id is not null;

create table public.weight_logs (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null default ((now() at time zone 'Asia/Taipei')::date),
  weight numeric(5, 1) not null check (weight between 20 and 400),
  created_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- ---------------------------------------------------------------------
-- 7. AI 使用額度（防止 Gemini 金鑰被濫用）
-- ---------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

create or replace function public.consume_ai_quota(p_daily_limit integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
  v_limit int := least(greatest(coalesce(p_daily_limit, 30), 1), 200);
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '請先登入' using errcode = '28000';
  end if;
  insert into public.ai_usage as u (user_id, day, count)
  values (v_uid, (now() at time zone 'Asia/Taipei')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning count into v_count;
  return v_count <= v_limit;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. 權限（Row Level Security）
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_counters enable row level security;
alter table public.food_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.ai_usage enable row level security;

-- Supabase 預設會把新資料表的全部權限給 anon/authenticated，這裡先全部收回再逐項開放
revoke all on public.profiles, public.merchants, public.products, public.orders,
  public.order_counters, public.food_logs, public.weight_logs, public.ai_usage
from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- profiles：只能看、改自己的資料；is_admin 欄位無法自行修改
grant select on public.profiles to authenticated;
grant update (display_name, phone, default_address, health) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- merchants：所有人可看已審核店家；擁有者可看、改自己的店；管理員可看、改全部
grant select on public.merchants to anon, authenticated;
grant insert, update on public.merchants to authenticated;
create policy merchants_select on public.merchants for select to anon, authenticated
using (
  status = 'approved'
  or owner_id = (select auth.uid())
  or (select public.is_admin())
);
create policy merchants_insert on public.merchants for insert to authenticated
with check ((owner_id = (select auth.uid()) and (select public.is_registered_user())) or (select public.is_admin()));
create policy merchants_update on public.merchants for update to authenticated
using (owner_id = (select auth.uid()) or (select public.is_admin()))
with check (owner_id = (select auth.uid()) or (select public.is_admin()));

-- products：已審核店家的餐點公開；店家只能管理自己的餐點
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
create policy products_select on public.products for select to anon, authenticated
using (
  exists (
    select 1 from public.merchants m
    where m.id = merchant_id
      and (m.status = 'approved' or m.owner_id = (select auth.uid()))
  )
  or (select public.is_admin())
);
create policy products_insert on public.products for insert to authenticated
with check (
  exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_id = (select auth.uid()))
  or (select public.is_admin())
);
create policy products_update on public.products for update to authenticated
using (
  exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_id = (select auth.uid()))
  or (select public.is_admin())
)
with check (
  exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_id = (select auth.uid()))
  or (select public.is_admin())
);
create policy products_delete on public.products for delete to authenticated
using (
  exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_id = (select auth.uid()))
  or (select public.is_admin())
);

-- orders：只能透過 place_order / update_order_status 寫入
grant select on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
using (
  customer_id = (select auth.uid())
  or exists (select 1 from public.merchants m where m.id = merchant_id and m.owner_id = (select auth.uid()))
  or (select public.is_admin())
);

-- 健康紀錄：只有本人
grant select, insert, update, delete on public.food_logs to authenticated;
create policy food_logs_owner on public.food_logs for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.is_registered_user()));

grant select, insert, update, delete on public.weight_logs to authenticated;
create policy weight_logs_owner on public.weight_logs for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.is_registered_user()));

-- 函式權限
revoke execute on function public.place_order(uuid, jsonb, text, text, text, text, text, text, integer, timestamptz) from public, anon;
revoke execute on function public.update_order_status(uuid, text, text) from public, anon;
revoke execute on function public.consume_ai_quota(integer) from public, anon;
revoke execute on function public.prepare_account_deletion() from public, anon;
revoke execute on function public.compute_order_item(public.products, text[], integer, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_merchant_changes() from public, anon, authenticated;
grant execute on function public.place_order(uuid, jsonb, text, text, text, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.update_order_status(uuid, text, text) to authenticated;
grant execute on function public.consume_ai_quota(integer) to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_registered_user() to anon, authenticated;
grant execute on function public.is_open_at(jsonb, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. 餐點圖片儲存空間（Supabase Storage）
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    drop policy if exists product_images_insert on storage.objects;
    create policy product_images_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

    drop policy if exists product_images_update on storage.objects;
    create policy product_images_update on storage.objects for update to authenticated
    using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

    drop policy if exists product_images_delete on storage.objects;
    create policy product_images_delete on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 10. 即時更新（Realtime）
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders', 'merchants', 'products']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
