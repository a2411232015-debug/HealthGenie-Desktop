-- =====================================================================
-- 移除示範店家（正式上線前執行）
-- =====================================================================
-- 會刪除：demo_data.sql 建立的 7 間「示範」店家、它們的餐點與訂單、示範帳號
-- 不會刪除：掛在你自己帳號底下的「我的健康餐盒」（請到店家後台自行修改或刪除餐點）
--
-- 在 Supabase 後台 SQL Editor 貼上並按 Run。
-- =====================================================================

begin;

create temp table demo_owners on commit drop as
  select id from auth.users where email like 'demo-store-%@healthgenie.invalid';

-- 訂單不能讓店家被直接刪除，所以先刪示範店家的訂單（餐點會跟著店家一起刪除）
delete from public.orders where merchant_id in (select id from public.merchants where owner_id in (select id from demo_owners));
delete from public.merchants where owner_id in (select id from demo_owners);
delete from auth.users where id in (select id from demo_owners);

commit;
