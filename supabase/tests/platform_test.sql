-- 資料庫權限與下單流程測試
-- 在套用 migrations 後的資料庫執行：psql -v ON_ERROR_STOP=1 -f supabase/tests/platform_test.sql
-- 任何一項失敗都會中止並顯示錯誤訊息。所有變更最後都會 rollback，不會留下測試資料。

begin;

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.act_as(p_uid uuid, p_anonymous boolean default false) returns void
language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anonymous)::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create function tests.as_postgres() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'FAILED: %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end $$;

-- 執行一段 SQL，預期失敗且錯誤訊息包含 p_expected
create function tests.fails(p_sql text, p_expected text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) > 0 then
      raise notice 'ok - % (%)', p_label, sqlerrm;
      return;
    end if;
    raise exception 'FAILED: % — unexpected error: %', p_label, sqlerrm;
  end;
  raise exception 'FAILED: % — expected an error containing "%"', p_label, p_expected;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- 測試帳號
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.tw', '{"display_name":"平台管理員"}'),
  ('b0000000-0000-0000-0000-000000000002', 'shop@test.tw', '{"display_name":"店長小美"}'),
  ('c0000000-0000-0000-0000-000000000003', 'eater@test.tw', '{}'),
  ('d0000000-0000-0000-0000-000000000004', 'other@test.tw', '{}');
update public.profiles set is_admin = true where id = 'a0000000-0000-0000-0000-000000000001';

select tests.ok((select count(*) = 4 from public.profiles), '註冊後自動建立 profile');
select tests.ok((select display_name = '店長小美' from public.profiles where id = 'b0000000-0000-0000-0000-000000000002'), 'profile 使用註冊時的名稱');
select tests.ok((select display_name = 'eater' from public.profiles where id = 'c0000000-0000-0000-0000-000000000003'), '沒有名稱時用 email 前綴');

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
select tests.act_as('c0000000-0000-0000-0000-000000000003');
update public.profiles set display_name = '小陳', phone = '0912345678' where id = 'c0000000-0000-0000-0000-000000000003';
select tests.ok((select display_name = '小陳' from public.profiles where id = 'c0000000-0000-0000-0000-000000000003'), '可以修改自己的資料');
select tests.fails($$update public.profiles set is_admin = true where id = 'c0000000-0000-0000-0000-000000000003'$$,
  'permission denied', '不能把自己設成管理員');
select tests.ok((select count(*) = 1 from public.profiles), '只看得到自己的 profile');
update public.profiles set display_name = 'hacked' where id = 'd0000000-0000-0000-0000-000000000004';
select tests.as_postgres();
select tests.ok((select display_name <> 'hacked' from public.profiles where id = 'd0000000-0000-0000-0000-000000000004'), '不能修改別人的資料');

-- ---------------------------------------------------------------------
-- 店家申請與審核
-- ---------------------------------------------------------------------
select tests.act_as('b0000000-0000-0000-0000-000000000002');
insert into public.merchants (id, owner_id, name, phone, address, opening_hours, status, delivery_enabled, delivery_fee, service_fee, discount, min_order_amount)
values ('e0000000-0000-0000-0000-00000000000e', 'd0000000-0000-0000-0000-000000000004', '小美健康餐盒', '0223456789', '台北市信義區松仁路100號',
  '[{"day":0,"open":"00:00","close":"23:59"},{"day":1,"open":"00:00","close":"23:59"},{"day":2,"open":"00:00","close":"23:59"},{"day":3,"open":"00:00","close":"23:59"},{"day":4,"open":"00:00","close":"23:59"},{"day":5,"open":"00:00","close":"23:59"},{"day":6,"open":"00:00","close":"23:59"},{"day":0,"open":"23:59","close":"00:00"},{"day":1,"open":"23:59","close":"00:00"},{"day":2,"open":"23:59","close":"00:00"},{"day":3,"open":"23:59","close":"00:00"},{"day":4,"open":"23:59","close":"00:00"},{"day":5,"open":"23:59","close":"00:00"},{"day":6,"open":"23:59","close":"00:00"}]',
  'approved', true, 40, 10, 15, 100);
select tests.ok((select status = 'pending' and owner_id = 'b0000000-0000-0000-0000-000000000002' from public.merchants), '申請時自動設為待審核，且擁有者是自己');
select tests.fails($$insert into public.merchants (name, phone, address) values ('第二間店', '0223456789', '台北市大安區某路1號')$$,
  'duplicate key', '一個帳號只能有一間店');
select tests.fails($$insert into public.merchants (name, phone, address, opening_hours) values ('壞時間', '0223456789', '台北市大安區某路1號', '[{"day":9,"open":"25:00","close":"10:00"}]')$$,
  'check constraint', '營業時間格式錯誤會被擋下');

-- 店家在審核期間就能先建立菜單
insert into public.products (id, merchant_id, name, category, price, nutrition, allergens, option_groups) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000e', '舒肥雞胸便當', '便當', 150,
   '{"calories":520,"protein":42,"fat":12,"carbs":58,"fiber":6,"sodium":650}', '{}',
   '[{"id":"rice","name":"飯量","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"rice_normal","name":"正常","priceDelta":0,"available":true},
      {"id":"rice_half","name":"減半","priceDelta":-10,"caloriesDelta":-100,"carbsDelta":-22,"available":true},
      {"id":"rice_brown","name":"糙米","priceDelta":10,"caloriesDelta":10,"fiberDelta":2,"available":false}]},
     {"id":"extra","name":"加料","type":"multiple","required":false,"minSelect":0,"maxSelect":2,"options":[
      {"id":"egg","name":"溫泉蛋","priceDelta":20,"caloriesDelta":70,"proteinDelta":6,"fatDelta":5,"available":true},
      {"id":"veg","name":"加青菜","priceDelta":15,"caloriesDelta":25,"fiberDelta":3,"available":true},
      {"id":"tofu","name":"加豆腐","priceDelta":15,"caloriesDelta":80,"proteinDelta":8,"available":true}]}]'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000e', '無糖綠茶', '飲料', 30, '{}', '{}', '[]'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e', '堅果優格', '點心', 80, '{"calories":250}', '{堅果,奶}', '[]');
select tests.ok((select count(*) = 3 from public.products), '店家可以建立自己的菜單');
select tests.fails($$insert into public.products (merchant_id, name, price, option_groups) values ('e0000000-0000-0000-0000-00000000000e', '壞規格', 100, '[{"id":"g","name":"x","type":"single","options":[]}]')$$,
  'check constraint', '沒有選項的規格群組會被擋下');
select tests.fails($$insert into public.products (merchant_id, name, price, option_groups) values ('e0000000-0000-0000-0000-00000000000e', '重複選項', 100, '[{"id":"g","name":"x","type":"multiple","maxSelect":2,"options":[{"id":"a","name":"A"},{"id":"a","name":"B"}]}]')$$,
  'check constraint', '重複的選項 id 會被擋下');
select tests.fails($$insert into public.products (merchant_id, name, price, option_groups) values ('e0000000-0000-0000-0000-00000000000e', '小數加價', 100, '[{"id":"g","name":"x","type":"single","options":[{"id":"a","name":"A","priceDelta":1.5}]}]')$$,
  'check constraint', '加價必須是整數');
select tests.fails($$insert into public.products (merchant_id, name, price, nutrition) values ('e0000000-0000-0000-0000-00000000000e', '壞營養', 100, '{"calories":"很多"}')$$,
  'check constraint', '營養數值必須是數字');
select tests.fails($$insert into public.products (merchant_id, name, price) values ('e0000000-0000-0000-0000-00000000000e', '負價格', -1)$$,
  'check constraint', '價格不可為負');

-- 店家不能自己核准
update public.merchants set status = 'approved' where id = 'e0000000-0000-0000-0000-00000000000e';
select tests.ok((select status = 'pending' from public.merchants where id = 'e0000000-0000-0000-0000-00000000000e'), '店家不能自己把狀態改成核准');

-- 尚未核准：其他人看不到
select tests.act_as(null);
select tests.ok((select count(*) = 0 from public.merchants), '未登入訪客看不到待審核店家');
select tests.ok((select count(*) = 0 from public.products), '未登入訪客看不到待審核店家的餐點');
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.ok((select count(*) = 0 from public.merchants), '其他會員看不到待審核店家');
select tests.fails($$insert into public.products (merchant_id, name, price) values ('e0000000-0000-0000-0000-00000000000e', '偷放的餐點', 1)$$,
  'row-level security', '不能在別人的店新增餐點');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":1,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-pending-0001')$$,
  '找不到這間店家', '待審核店家不能接單');

-- 管理員核准
select tests.act_as('a0000000-0000-0000-0000-000000000001');
select tests.ok((select count(*) = 1 from public.merchants where status = 'pending'), '管理員看得到待審核店家');
update public.merchants set status = 'approved', review_note = '資料齊全' where id = 'e0000000-0000-0000-0000-00000000000e';
select tests.ok((select status = 'approved' from public.merchants where id = 'e0000000-0000-0000-0000-00000000000e'), '管理員可以核准店家');

select tests.act_as(null);
select tests.ok((select count(*) = 1 from public.merchants), '核准後未登入訪客也看得到店家');
select tests.ok((select count(*) = 3 from public.products), '核准後看得到菜單');
select tests.fails($$update public.merchants set name = 'x'$$, 'permission denied', '訪客不能修改店家');

-- ---------------------------------------------------------------------
-- 下單：價格由伺服器計算
-- ---------------------------------------------------------------------
select tests.act_as('c0000000-0000-0000-0000-000000000003');
create temp table t_result (id uuid, total int, order_number text);
grant all on t_result to authenticated;

-- 便當(150) 減半(-10) + 溫泉蛋(20) + 加青菜(15) = 175 × 2 = 350；綠茶 30 × 1；小計 380
-- 自取：運費 0、服務費 10、折抵 15 → 375
insert into t_result
select id, total, order_number from public.place_order(
  'e0000000-0000-0000-0000-00000000000e',
  '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":2,"optionIds":["rice_half","egg","veg"],"remark":"醬少一點"},
    {"productId":"f0000000-0000-0000-0000-000000000002","quantity":1,"optionIds":[],"unitPrice":1}]',
  'pickup', '小陳', '0912-345-678', '', '謝謝', 'req-first-order-0001', 375);
select tests.ok((select total = 375 from t_result), '伺服器計算總金額 375（前端傳來的單價會被忽略）');
select tests.ok((select order_number ~ '^[0-9]{6}-0001$' from t_result), '今天第一張單的取餐號碼是 0001');

select tests.as_postgres();
select tests.ok((select subtotal = 380 and service_fee = 10 and discount = 15 and delivery_fee = 0 and item_count = 3 from public.orders), '小計、服務費、折抵、件數正確');
select tests.ok((select (items -> 0 ->> 'unitPrice')::int = 175 and (items -> 0 ->> 'subtotal')::int = 350 from public.orders), '品項單價與小計正確');
select tests.ok((select (items -> 0 -> 'unitNutrition' ->> 'calories')::numeric = 515 and (items -> 0 -> 'unitNutrition' ->> 'protein')::numeric = 48 and (items -> 0 -> 'unitNutrition' ->> 'carbs')::numeric = 36 from public.orders), '營養素依選項正確加總');
select tests.ok((select items -> 1 -> 'unitNutrition' = 'null'::jsonb from public.orders), '沒有營養標示的餐點不會亂算');
select tests.ok((select contact_phone = '0912345678' and items -> 0 ->> 'remark' = '醬少一點' from public.orders), '電話格式化、備註保留');
select tests.ok((select jsonb_array_length(status_history) = 1 and estimated_ready_at > now() from public.orders), '有狀態紀錄與預估完成時間');

select tests.act_as('c0000000-0000-0000-0000-000000000003');
-- 同一個 client_request_id 再送一次 → 回傳同一張單
select tests.ok((select id from public.place_order(
  'e0000000-0000-0000-0000-00000000000e',
  '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":9,"optionIds":[]}]',
  'pickup', '小陳', '0912345678', '', '', 'req-first-order-0001')) = (select id from t_result), '重複送出不會產生第二張訂單');
select tests.ok((select count(*) = 1 from public.orders), '仍然只有一張訂單');

select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":5,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-price-check-01', 100)$$,
  '價格已更新為 NT$145', '前端顯示金額與伺服器不同時會提醒');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":1,"optionIds":["egg"]}]', 'pickup', '小陳', '0912345678', '', '', 'req-missing-req-01')$$,
  '請選擇飯量', '必選規格沒選會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":1,"optionIds":["rice_normal","rice_half"]}]', 'pickup', '小陳', '0912345678', '', '', 'req-two-single-01')$$,
  '飯量最多選擇 1 項', '單選規格選兩個會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":1,"optionIds":["rice_normal","egg","veg","tofu"]}]', 'pickup', '小陳', '0912345678', '', '', 'req-too-many-01')$$,
  '加料最多選擇 2 項', '複選超過上限會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":1,"optionIds":["rice_normal","free_steak"]}]', 'pickup', '小陳', '0912345678', '', '', 'req-fake-option-01')$$,
  '選項已更新', '不存在的選項會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000001","quantity":1,"optionIds":["rice_brown"]}]', 'pickup', '小陳', '0912345678', '', '', 'req-soldout-opt-01')$$,
  '已停售', '停售的選項會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":0,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-zero-qty-01')$$,
  '數量需介於 1 到 50', '數量 0 會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":"abc","optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-bad-qty-01')$$,
  '購物車內容不正確', '格式錯誤的數量會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000002","quantity":1,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-min-order-01')$$,
  '未達最低訂購金額 NT$100', '未達最低訂購金額會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '小陳', '12345', '', '', 'req-bad-phone-01')$$,
  '請填寫正確的聯絡電話', '電話格式錯誤會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'delivery', '小陳', '0912345678', '', '', 'req-no-address-01')$$,
  '請填寫完整的外送地址', '外送沒填地址會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '', '0912345678', '', '', 'req-no-name-01')$$,
  '請填寫訂購人姓名', '沒填姓名會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-999999999999","quantity":2,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-unknown-prod-01')$$,
  '已下架', '不存在的餐點會被擋下');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[]', 'pickup', '小陳', '0912345678', '', '', 'req-empty-cart-01')$$,
  '購物車內容不正確', '空購物車會被擋下');
select tests.fails($$insert into public.orders (order_number, customer_id, merchant_id, client_request_id, fulfillment, items, item_count, subtotal, total, merchant_name, merchant_phone, merchant_address, contact_name, contact_phone) values ('x', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-00000000000e', 'direct-insert-01', 'pickup', '[]', 1, 1, 1, 'x', 'x', 'x', 'x', 'x')$$,
  'permission denied', '不能繞過 place_order 直接寫入訂單');
select tests.fails($$update public.orders set total = 1$$, 'permission denied', '不能直接修改訂單金額');
select tests.fails($$delete from public.orders$$, 'permission denied', '不能刪除訂單');
select tests.fails($$select public.compute_order_item(null, '{}', 1, '')$$, 'permission denied', '內部計價函式不能直接呼叫');

-- 外送：運費 40；堅果優格 80 × 2 = 160 + 40 + 10 - 15 = 195
truncate t_result;
insert into t_result select id, total, order_number from public.place_order('e0000000-0000-0000-0000-00000000000e',
  '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]',
  'delivery', '小陳', '02-2345-6789', '台北市大安區復興南路一段1號', '', 'req-delivery-0001', 195);
select tests.ok((select total = 195 and order_number ~ '-0002$' from t_result), '外送訂單含運費 195，取餐號碼遞增為 0002');

-- 匿名帳號不能下單
select tests.act_as('d0000000-0000-0000-0000-000000000004', true);
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '路人', '0912345678', '', '', 'req-anon-user-01')$$,
  '請先登入會員', '匿名帳號不能下單');
select tests.fails($$insert into public.merchants (name, phone, address) values ('匿名開店', '0223456789', '台北市大安區某路1號')$$,
  'row-level security', '匿名帳號不能申請開店');
select tests.fails($$insert into public.food_logs (name, calories) values ('匿名紀錄', 100)$$,
  'row-level security', '匿名帳號不能寫飲食紀錄');
select tests.act_as(null);
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[]', 'pickup', '路人', '0912345678', '', '', 'req-not-logged-01')$$,
  'permission denied', '未登入不能下單');

-- ---------------------------------------------------------------------
-- 訂單可見範圍
-- ---------------------------------------------------------------------
select tests.act_as('d0000000-0000-0000-0000-000000000004');
select tests.ok((select count(*) = 0 from public.orders), '其他顧客看不到別人的訂單');
select tests.act_as('b0000000-0000-0000-0000-000000000002');
select tests.ok((select count(*) = 2 from public.orders), '店家看得到下給自己的訂單');
select tests.act_as('a0000000-0000-0000-0000-000000000001');
select tests.ok((select count(*) = 2 from public.orders), '管理員看得到全部訂單');

-- ---------------------------------------------------------------------
-- 訂單狀態流程
-- ---------------------------------------------------------------------
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.fails($$select public.update_order_status((select id from public.orders where order_number like '%-0001'), 'preparing')$$,
  '無法改為這個狀態', '顧客不能幫店家接單');
select tests.act_as('d0000000-0000-0000-0000-000000000004');
select tests.fails($$select public.update_order_status('00000000-0000-0000-0000-000000000000', 'cancelled')$$,
  '找不到這張訂單', '不存在的訂單');
select tests.as_postgres();
create temp table t_ids as select id, order_number from public.orders;
grant select on t_ids to authenticated;
select tests.act_as('d0000000-0000-0000-0000-000000000004');
select tests.fails($$select public.update_order_status((select id from t_ids where order_number like '%-0001'), 'cancelled')$$,
  '找不到這張訂單', '別人不能取消我的訂單');

select tests.act_as('b0000000-0000-0000-0000-000000000002');
select tests.ok((select status = 'preparing' from public.update_order_status((select id from t_ids where order_number like '%-0001'), 'preparing')), '店家接單 → 製作中');
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.fails($$select public.update_order_status((select id from t_ids where order_number like '%-0001'), 'cancelled')$$,
  '店家已開始處理', '店家接單後顧客不能自行取消');
select tests.act_as('b0000000-0000-0000-0000-000000000002');
select tests.ok((select status = 'ready' from public.update_order_status((select id from t_ids where order_number like '%-0001'), 'ready')), '製作完成 → 待取餐');
select tests.fails($$select public.update_order_status((select id from t_ids where order_number like '%-0001'), 'delivering')$$,
  '無法改為這個狀態', '自取訂單不能改成配送中');
select tests.ok((select status = 'completed' and payment_status = 'paid' and completed_at is not null and jsonb_array_length(status_history) = 4
  from public.update_order_status((select id from t_ids where order_number like '%-0001'), 'completed')), '取餐完成 → 已完成、已收款');
select tests.fails($$select public.update_order_status((select id from t_ids where order_number like '%-0001'), 'cancelled', '測試')$$,
  '無法改為這個狀態', '已完成的訂單不能再取消');
select tests.fails($$select public.update_order_status((select id from t_ids where order_number like '%-0002'), 'rejected')$$,
  '請填寫原因', '拒單必須填原因');

select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.ok((select status = 'cancelled' and cancel_reason = '顧客取消訂單'
  from public.update_order_status((select id from t_ids where order_number like '%-0002'), 'cancelled')), '店家接單前顧客可以取消');

-- ---------------------------------------------------------------------
-- 營業狀態
-- ---------------------------------------------------------------------
select tests.act_as('b0000000-0000-0000-0000-000000000002');
update public.merchants set accepting_orders = false;
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-paused-0001')$$,
  '暫停接單', '暫停接單時不能下單');
select tests.act_as('b0000000-0000-0000-0000-000000000002');
update public.merchants set accepting_orders = true, opening_hours = '[]';
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-closed-0001')$$,
  '不在營業時間', '非營業時間不能下單');
select tests.act_as('b0000000-0000-0000-0000-000000000002');
update public.products set available = false where id = 'f0000000-0000-0000-0000-000000000003';
update public.merchants set opening_hours = '[{"day":0,"open":"00:00","close":"23:59"},{"day":1,"open":"00:00","close":"23:59"},{"day":2,"open":"00:00","close":"23:59"},{"day":3,"open":"00:00","close":"23:59"},{"day":4,"open":"00:00","close":"23:59"},{"day":5,"open":"00:00","close":"23:59"},{"day":6,"open":"00:00","close":"23:59"},{"day":0,"open":"23:59","close":"00:00"},{"day":1,"open":"23:59","close":"00:00"},{"day":2,"open":"23:59","close":"00:00"},{"day":3,"open":"23:59","close":"00:00"},{"day":4,"open":"23:59","close":"00:00"},{"day":5,"open":"23:59","close":"00:00"},{"day":6,"open":"23:59","close":"00:00"}]';
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.fails($$select public.place_order('e0000000-0000-0000-0000-00000000000e', '[{"productId":"f0000000-0000-0000-0000-000000000003","quantity":2,"optionIds":[]}]', 'pickup', '小陳', '0912345678', '', '', 'req-soldout-0001')$$,
  '已售完', '售完的餐點不能下單');

select tests.as_postgres();
-- 2026-10-05 是週一
select tests.ok(public.is_open_at('[{"day":1,"open":"11:00","close":"14:00"}]', '2026-10-05 12:00+08'), '週一中午營業中');
select tests.ok(not public.is_open_at('[{"day":1,"open":"11:00","close":"14:00"}]', '2026-10-05 14:00+08'), '打烊時間整點就不能下單');
select tests.ok(not public.is_open_at('[{"day":1,"open":"11:00","close":"14:00"}]', '2026-10-06 12:00+08'), '週二沒有營業');
select tests.ok(public.is_open_at('[{"day":5,"open":"18:00","close":"02:00"}]', '2026-10-10 01:30+08'), '週五跨夜營業到週六凌晨');
select tests.ok(not public.is_open_at('[{"day":5,"open":"18:00","close":"02:00"}]', '2026-10-10 02:30+08'), '跨夜時段結束後打烊');
select tests.ok(public.is_open_at('[{"day":1,"open":"11:00","close":"14:00"}]', '2026-10-05 04:00+00'), '用台北時間判斷（UTC 04:00 = 台北 12:00）');

-- ---------------------------------------------------------------------
-- 店家停權與退件
-- ---------------------------------------------------------------------
select tests.act_as('a0000000-0000-0000-0000-000000000001');
update public.merchants set status = 'rejected', review_note = '請補上完整地址';
select tests.act_as('b0000000-0000-0000-0000-000000000002');
update public.merchants set address = '台北市信義區松仁路100號1樓';
select tests.ok((select status = 'pending' and review_note = '請補上完整地址' from public.merchants), '退件後修改資料會自動重新送審');
select tests.ok((select count(*) = 3 from public.products), '店家在審核期間看得到自己的菜單');
select tests.act_as('c0000000-0000-0000-0000-000000000003');
select tests.ok((select count(*) = 0 from public.products), '店家未核准時顧客看不到菜單');
select tests.ok((select count(*) = 2 from public.orders), '顧客仍看得到自己過去的訂單');

-- ---------------------------------------------------------------------
-- 健康紀錄與 AI 額度
-- ---------------------------------------------------------------------
select tests.act_as('c0000000-0000-0000-0000-000000000003');
insert into public.food_logs (name, calories, protein, source) values ('早餐蛋餅', 320, 12, 'manual');
insert into public.food_logs (name, calories, source, order_id) values ('舒肥雞胸便當', 515, 'order', (select id from t_ids where order_number like '%-0001'));
select tests.fails($$insert into public.food_logs (name, calories, source, order_id) values ('舒肥雞胸便當', 515, 'order', (select id from t_ids where order_number like '%-0001'))$$,
  'duplicate key', '同一張訂單不會被重複記錄');
insert into public.weight_logs (weight) values (70.5);
insert into public.weight_logs (weight) values (70.2) on conflict (user_id, log_date) do update set weight = excluded.weight;
select tests.ok((select weight = 70.2 from public.weight_logs), '同一天的體重會更新而不是重複');
select tests.fails($$insert into public.food_logs (user_id, name, calories) values ('d0000000-0000-0000-0000-000000000004', '幫別人記', 100)$$,
  'row-level security', '不能幫別人寫飲食紀錄');
select tests.act_as('d0000000-0000-0000-0000-000000000004');
select tests.ok((select count(*) = 0 from public.food_logs), '看不到別人的飲食紀錄');
select tests.ok((select count(*) = 0 from public.weight_logs), '看不到別人的體重');
select tests.ok(public.consume_ai_quota(2), 'AI 額度第 1 次');
select tests.ok(public.consume_ai_quota(2), 'AI 額度第 2 次');
select tests.ok(not public.consume_ai_quota(2), 'AI 額度用完後拒絕');
select tests.act_as(null);
select tests.fails($$select public.consume_ai_quota()$$, 'permission denied', '未登入不能使用 AI');

-- ---------------------------------------------------------------------
-- Storage 圖片權限
-- ---------------------------------------------------------------------
select tests.as_postgres();
select tests.ok((select count(*) = 1 from storage.buckets where id = 'product-images' and public), '建立公開的餐點圖片空間');
select tests.ok((select count(*) = 3 from pg_policies where schemaname = 'storage' and policyname like 'product_images_%'), '圖片只能上傳到自己的資料夾');

do $$ begin raise notice '全部測試通過'; end $$;

rollback;
