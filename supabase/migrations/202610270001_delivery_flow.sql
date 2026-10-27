-- =====================================================================
-- HealthGenie 外送流程補強 + 營養資料來源標示
--   1. 餐點加上「營養資料來源」：店家提供 / AI 估算（經店家確認）
--   2. 訂單加上：顧客定位、店家設定的製作時間、出發配送時間、送達時間
--   3. 新增「已送達」狀態，完整流程：
--        送出訂單 → 店家接單並設定製作時間 → 餐點完成 → 外送員取餐出發
--        → 已送達（外送員按） → 顧客確認收到 → 完成
--   4. 顧客可以在「配送中／已送達」時按「確認收到餐點」完成訂單；
--      顧客沒按時，店家可以幫忙結單。
-- 這支 migration 與舊版網頁相容：舊網頁呼叫 place_order / update_order_status
-- 時不帶新參數也能正常運作。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 餐點營養資料來源
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists nutrition_source text not null default 'merchant';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_nutrition_source_check'
  ) then
    alter table public.products
      add constraint products_nutrition_source_check check (nutrition_source in ('merchant', 'ai'));
  end if;
end;
$$;

comment on column public.products.nutrition_source is
  '營養資料來源：merchant = 店家提供；ai = AI 估算後由店家確認';

-- ---------------------------------------------------------------------
-- 2. 訂單外送欄位
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists prep_minutes integer,
  add column if not exists delivering_at timestamptz,
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_delivery_location_check'
  ) then
    alter table public.orders add constraint orders_delivery_location_check check (
      (delivery_lat is null and delivery_lng is null)
      or (delivery_lat between -90 and 90 and delivery_lng between -180 and 180)
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_prep_minutes_check'
  ) then
    alter table public.orders add constraint orders_prep_minutes_check
      check (prep_minutes is null or prep_minutes between 5 and 180);
  end if;
end;
$$;

-- 狀態加上 delivered（已送達，等顧客確認）
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%delivering%'
  loop
    execute format('alter table public.orders drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.orders add constraint orders_status_check check (status in (
  'pending', 'preparing', 'ready', 'delivering', 'delivered', 'completed', 'cancelled', 'rejected'
));

-- ---------------------------------------------------------------------
-- 3. 下單：外送可以附上顧客定位（選填），讓店家導航、估算送達時間
-- ---------------------------------------------------------------------
drop function if exists public.place_order(uuid, jsonb, text, text, text, text, text, text, integer, timestamptz);

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
  p_scheduled_for timestamptz default null,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null
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
  v_lat double precision;
  v_lng double precision;
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
    if (p_delivery_lat is null) <> (p_delivery_lng is null)
      or (p_delivery_lat is not null and (p_delivery_lat not between -90 and 90 or p_delivery_lng not between -180 and 180)) then
      raise exception '定位資料不正確，請重新取得位置';
    end if;
    -- 只保留到小數第 5 位（約 1 公尺），夠導航用即可
    v_lat := round(p_delivery_lat::numeric, 5)::double precision;
    v_lng := round(p_delivery_lng::numeric, 5)::double precision;
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
      estimated_ready_at, scheduled_for, status_history,
      delivery_lat, delivery_lng
    ) values (
      to_char(v_day, 'YYMMDD') || '-' || lpad(v_number::text, 4, '0'),
      v_uid, p_merchant_id, p_client_request_id, 'pending', p_fulfillment,
      v_lines, v_item_count, v_subtotal, v_delivery_fee, v_merchant.service_fee, v_discount, v_total,
      v_merchant.name, v_merchant.phone, v_merchant.address,
      v_name, v_phone, case when p_fulfillment = 'delivery' then v_address else '' end, v_note,
      coalesce(p_scheduled_for, now() + make_interval(mins => v_merchant.prep_minutes)),
      p_scheduled_for,
      jsonb_build_array(jsonb_build_object('status', 'pending', 'at', now())),
      v_lat, v_lng
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

-- ---------------------------------------------------------------------
-- 4. 更新訂單狀態
--    店家：接單（可設定製作時間 5–180 分鐘）、餐點完成、出發配送、已送達、結單
--    顧客：店家接單前可取消；配送中／已送達時可確認收到
-- ---------------------------------------------------------------------
drop function if exists public.update_order_status(uuid, text, text);

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text,
  p_reason text default '',
  p_prep_minutes integer default null
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
  v_delivery boolean;
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
  v_delivery := v_order.fulfillment = 'delivery';

  if not v_is_merchant and not v_is_customer then
    raise exception '找不到這張訂單';
  end if;

  if p_prep_minutes is not null then
    if p_status <> 'preparing' then
      raise exception '只有接單時可以設定製作時間';
    end if;
    if p_prep_minutes not between 5 and 180 then
      raise exception '製作時間需在 5 到 180 分鐘之間';
    end if;
    v_prep := p_prep_minutes;
  end if;

  if v_is_merchant then
    v_allowed := (v_order.status, p_status) in (
      ('pending', 'preparing'),
      ('pending', 'rejected'),
      ('preparing', 'ready'),
      ('preparing', 'cancelled'),
      ('ready', 'cancelled')
    )
    or (not v_delivery and v_order.status = 'ready' and p_status = 'completed')
    or (v_delivery and (v_order.status, p_status) in (
      ('ready', 'delivering'),
      ('delivering', 'delivered'),
      ('delivered', 'completed'),
      -- 相容舊版網頁：配送中直接結單
      ('delivering', 'completed')
    ));
  end if;
  if not v_allowed and v_is_customer then
    v_allowed := (v_order.status = 'pending' and p_status = 'cancelled')
      or (v_delivery and v_order.status in ('delivering', 'delivered') and p_status = 'completed');
    if v_allowed and p_status = 'cancelled' and v_reason = '' then
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
    prep_minutes = case when p_status = 'preparing' then v_prep else prep_minutes end,
    estimated_ready_at = case when p_status = 'preparing' then greatest(coalesce(scheduled_for, now()), now() + make_interval(mins => v_prep)) else estimated_ready_at end,
    delivering_at = case when p_status = 'delivering' then now() else delivering_at end,
    delivered_at = case
      when p_status = 'delivered' then now()
      when p_status = 'completed' and v_delivery and delivered_at is null then now()
      else delivered_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    -- 現金付款：外送在送達時收款，自取在取餐時收款
    payment_status = case when p_status in ('delivered', 'completed') then 'paid' else payment_status end,
    status_history = status_history || jsonb_build_array(jsonb_build_object('status', p_status, 'at', now()))
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 刪除帳號：進行中的訂單也包含「已送達」；清除定位
-- ---------------------------------------------------------------------
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
    where customer_id = v_uid and status in ('pending', 'preparing', 'ready', 'delivering', 'delivered')
  ) then
    raise exception '你還有進行中的訂單，請等訂單完成或取消後再刪除帳號';
  end if;

  update public.orders set
    contact_name = '已刪除的會員',
    contact_phone = '',
    delivery_address = case when delivery_address = '' then '' else '（已刪除）' end,
    delivery_lat = null,
    delivery_lng = null,
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
-- 6. 權限
-- ---------------------------------------------------------------------
revoke execute on function public.place_order(uuid, jsonb, text, text, text, text, text, text, integer, timestamptz, double precision, double precision) from public, anon;
revoke execute on function public.update_order_status(uuid, text, text, integer) from public, anon;
grant execute on function public.place_order(uuid, jsonb, text, text, text, text, text, text, integer, timestamptz, double precision, double precision) to authenticated;
grant execute on function public.update_order_status(uuid, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
