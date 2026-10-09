-- =====================================================================
-- 示範資料：8 間健康餐店家、約 30 道有營養標示的餐點
-- =====================================================================
-- 用途：剛架好平台時，讓你可以直接體驗「逛店家 → 點餐 → 店家接單」整個流程。
--
-- 使用方式：
--   1. 先在網站上用 Email 註冊一個帳號
--   2. 把下面 v_owner_email 換成那個 Email
--   3. 在 Supabase 後台 SQL Editor 貼上整個檔案並按 Run
--
-- 結果：
--   - 「我的健康餐盒」會掛在你的帳號底下，你可以在「我的店家」接單、改菜單、改營業時間
--   - 另外 7 間是「示範」店家（店名有標示），掛在無法登入的示範帳號底下，
--     可以下單體驗流程，但不會有人接單
--   - 重複執行不會產生重複的店家
--
-- 正式上線前，用 supabase/seed/remove_demo_data.sql 移除 7 間示範店家。
-- =====================================================================

do $seed$
declare
  v_owner_email text := 'you@example.com';  -- ← 換成你在網站註冊的 Email

  v_owner uuid;
  v_store jsonb;
  v_product jsonb;
  v_store_owner uuid;
  v_merchant uuid;
  v_hours jsonb;
  v_sort int;
  v_created int := 0;

  -- 便當類共用規格：飯量、口味、加料
  v_bento_options constant jsonb := $json$[
    {"id":"rice","name":"飯量","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"rice_normal","name":"正常飯量","priceDelta":0,"available":true},
      {"id":"rice_half","name":"飯量減半","priceDelta":0,"caloriesDelta":-100,"carbsDelta":-22,"available":true},
      {"id":"rice_brown","name":"換成糙米","priceDelta":10,"caloriesDelta":10,"proteinDelta":1,"fiberDelta":2,"available":true},
      {"id":"rice_none","name":"不要飯（換青菜）","priceDelta":0,"caloriesDelta":-180,"carbsDelta":-38,"fiberDelta":3,"available":true}]},
    {"id":"flavor","name":"口味","type":"multiple","required":false,"minSelect":0,"maxSelect":3,"options":[
      {"id":"sauce_side","name":"醬料分開","priceDelta":0,"available":true},
      {"id":"less_salt","name":"少鹽","priceDelta":0,"sodiumDelta":-150,"available":true},
      {"id":"less_oil","name":"少油","priceDelta":0,"caloriesDelta":-35,"fatDelta":-4,"available":true}]},
    {"id":"extra","name":"加料","type":"multiple","required":false,"minSelect":0,"maxSelect":3,"options":[
      {"id":"extra_chicken","name":"加雞胸肉","priceDelta":40,"caloriesDelta":110,"proteinDelta":23,"fatDelta":2,"sodiumDelta":120,"available":true},
      {"id":"extra_egg","name":"加溫泉蛋","priceDelta":15,"caloriesDelta":70,"proteinDelta":6,"fatDelta":5,"available":true},
      {"id":"extra_veg","name":"增加蔬菜","priceDelta":20,"caloriesDelta":25,"proteinDelta":1,"carbsDelta":4,"fiberDelta":4,"available":true}]}
  ]$json$;

  -- 沙拉／餐碗：醬料、加料
  v_bowl_options constant jsonb := $json$[
    {"id":"dressing","name":"醬料","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"dress_wafu","name":"和風醬","priceDelta":0,"caloriesDelta":45,"fatDelta":3,"sodiumDelta":280,"available":true},
      {"id":"dress_vinegar","name":"巴薩米克醋","priceDelta":0,"caloriesDelta":30,"carbsDelta":6,"sodiumDelta":60,"available":true},
      {"id":"dress_sesame","name":"胡麻醬","priceDelta":0,"caloriesDelta":90,"fatDelta":8,"sodiumDelta":200,"available":true},
      {"id":"dress_side","name":"醬料分開","priceDelta":0,"available":true}]},
    {"id":"topping","name":"加料","type":"multiple","required":false,"minSelect":0,"maxSelect":2,"options":[
      {"id":"top_egg","name":"加水煮蛋","priceDelta":15,"caloriesDelta":75,"proteinDelta":6,"fatDelta":5,"available":true},
      {"id":"top_avocado","name":"加酪梨","priceDelta":35,"caloriesDelta":80,"fatDelta":7,"fiberDelta":3,"available":true},
      {"id":"top_quinoa","name":"加藜麥","priceDelta":20,"caloriesDelta":60,"proteinDelta":2,"carbsDelta":11,"fiberDelta":1,"available":true}]}
  ]$json$;

  -- 飲品：冰塊
  v_drink_options constant jsonb := $json$[
    {"id":"ice","name":"冰塊","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"ice_normal","name":"正常冰","priceDelta":0,"available":true},
      {"id":"ice_less","name":"少冰","priceDelta":0,"available":true},
      {"id":"ice_none","name":"去冰","priceDelta":0,"available":true},
      {"id":"ice_hot","name":"熱的","priceDelta":0,"available":true}]}
  ]$json$;

  -- 咖啡：牛奶
  v_milk_options constant jsonb := $json$[
    {"id":"milk","name":"奶類","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"milk_whole","name":"鮮奶","priceDelta":0,"available":true},
      {"id":"milk_skim","name":"低脂鮮奶","priceDelta":0,"caloriesDelta":-40,"fatDelta":-5,"available":true},
      {"id":"milk_oat","name":"燕麥奶","priceDelta":15,"caloriesDelta":10,"proteinDelta":-5,"carbsDelta":8,"available":true}]},
    {"id":"ice","name":"冰塊","type":"single","required":true,"minSelect":1,"maxSelect":1,"options":[
      {"id":"ice_normal","name":"正常冰","priceDelta":0,"available":true},
      {"id":"ice_none","name":"去冰","priceDelta":0,"available":true},
      {"id":"ice_hot","name":"熱的","priceDelta":0,"available":true}]}
  ]$json$;

  v_stores constant jsonb := $json$[
    {
      "self": true,
      "name": "我的健康餐盒",
      "description": "每天現做的低油健康餐盒，熱量與營養標示清楚。（示範菜單，可以在店家後台自由修改）",
      "phone": "02-0000-0000", "address": "台北市信義區（請在店家設定改成你的地址）", "lat": 25.033, "lng": 121.5654,
      "cover": "https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=80",
      "open": "07:00", "close": "02:00", "closedDays": [],
      "pickup": true, "delivery": true, "deliveryFee": 30, "serviceFee": 0, "discount": 0, "minOrder": 0, "prep": 15,
      "products": [
        {"name":"香草雞胸彩蔬餐盒","category":"餐盒","price":170,"options":"bento","image":"https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=800&q=80",
         "description":"香草醃製雞胸、五色時蔬、白飯。店長推薦，高蛋白低脂。",
         "nutrition":{"calories":430,"protein":40,"fat":9,"carbs":42,"fiber":7,"sodium":420,"sugar":4},"allergens":[]},
        {"name":"椒麻雞腿排餐盒","category":"餐盒","price":180,"options":"bento",
         "description":"去皮雞腿排、自製椒麻醬、高麗菜、白飯。",
         "nutrition":{"calories":560,"protein":36,"fat":18,"carbs":58,"fiber":5,"sodium":780,"sugar":6},"allergens":["花生"]},
        {"name":"鹽烤鯖魚餐盒","category":"餐盒","price":190,"options":"bento",
         "description":"挪威鯖魚、溏心蛋、季節蔬菜、白飯。富含 Omega-3。",
         "nutrition":{"calories":610,"protein":32,"fat":26,"carbs":55,"fiber":5,"sodium":690,"sugar":3},"allergens":["海鮮","蛋"]},
        {"name":"和風豆腐溫沙拉","category":"沙拉","price":140,"options":"bowl",
         "description":"板豆腐、毛豆、玉米、生菜。素食者也可以吃。",
         "nutrition":{"calories":290,"protein":19,"fat":13,"carbs":24,"fiber":8,"sodium":320,"sugar":5},"allergens":["大豆"]},
        {"name":"番茄蔬菜雞湯","category":"湯品","price":70,
         "description":"牛番茄、洋蔥、高麗菜與雞胸丁慢火熬煮。",
         "nutrition":{"calories":120,"protein":11,"fat":3,"carbs":12,"fiber":3,"sodium":480,"sugar":6},"allergens":[]},
        {"name":"堅果優格杯","category":"點心","price":80,
         "description":"無糖優格、綜合堅果、新鮮莓果。",
         "nutrition":{"calories":250,"protein":12,"fat":14,"carbs":20,"fiber":3,"sodium":60,"sugar":12},"allergens":["奶","堅果"]},
        {"name":"無糖豆漿","category":"飲品","price":35,"options":"drink",
         "description":"非基改黃豆現磨。",
         "nutrition":{"calories":110,"protein":9,"fat":5,"carbs":6,"fiber":2,"sodium":15,"sugar":1},"allergens":["大豆"]},
        {"name":"無糖綠茶","category":"飲品","price":30,"options":"drink",
         "description":"台灣四季春茶葉。",
         "nutrition":{"calories":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sodium":5,"sugar":0},"allergens":[]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d001",
      "name": "Muscle Fuel 健康餐（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。主打增肌高蛋白餐盒。",
      "phone": "02-0000-0001", "address": "台北市大安區忠孝東路四段（示範地址）", "lat": 25.041, "lng": 121.55,
      "cover": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80",
      "open": "10:30", "close": "21:00", "closedDays": [],
      "pickup": true, "delivery": true, "deliveryFee": 30, "serviceFee": 15, "discount": 15, "minOrder": 150, "prep": 20,
      "products": [
        {"name":"舒肥雞胸藜麥餐盒","category":"增肌餐盒","price":160,"options":"bento","image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80",
         "description":"低溫舒肥雞胸、藜麥飯、花椰菜、南瓜。",
         "nutrition":{"calories":450,"protein":42,"fat":8,"carbs":45,"fiber":6,"sodium":450,"sugar":3},"allergens":[]},
        {"name":"雙倍雞胸增肌餐盒","category":"增肌餐盒","price":220,"options":"bento",
         "description":"兩份舒肥雞胸，一餐 70 克蛋白質。",
         "nutrition":{"calories":640,"protein":72,"fat":11,"carbs":48,"fiber":6,"sodium":640,"sugar":3},"allergens":[]},
        {"name":"牛肉地瓜能量餐盒","category":"增肌餐盒","price":210,
         "description":"嫩煎牛肩、烤地瓜、四季豆。",
         "nutrition":{"calories":580,"protein":38,"fat":20,"carbs":55,"fiber":7,"sodium":520,"sugar":9},"allergens":[]},
        {"name":"乳清蛋白飲","category":"飲品","price":90,
         "description":"巧克力口味，一瓶 25 克蛋白質。",
         "nutrition":{"calories":160,"protein":25,"fat":2,"carbs":8,"fiber":1,"sodium":150,"sugar":3},"allergens":["奶","大豆"]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d002",
      "name": "Daily Fresh 輕食（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。沙拉與五穀飯輕食。",
      "phone": "02-0000-0002", "address": "台北市信義區松仁路（示範地址）", "lat": 25.036, "lng": 121.568,
      "cover": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
      "open": "10:00", "close": "19:30", "closedDays": [0],
      "pickup": true, "delivery": true, "deliveryFee": 35, "serviceFee": 15, "discount": 0, "minOrder": 0, "prep": 20,
      "products": [
        {"name":"香煎鮭魚五穀飯","category":"五穀飯","price":220,"options":"bento","image":"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
         "description":"智利鮭魚、五穀飯、烤時蔬。",
         "nutrition":{"calories":580,"protein":35,"fat":18,"carbs":60,"fiber":7,"sodium":580,"sugar":4},"allergens":["海鮮"]},
        {"name":"雞肉凱薩沙拉","category":"沙拉","price":160,"options":"bowl",
         "description":"烤雞胸、蘿蔓、帕瑪森起司、水煮蛋。",
         "nutrition":{"calories":380,"protein":32,"fat":20,"carbs":14,"fiber":4,"sodium":610,"sugar":3},"allergens":["蛋","奶"]},
        {"name":"鷹嘴豆鮮蔬捲餅","category":"捲餅","price":140,
         "description":"全麥餅皮、鷹嘴豆泥、烤甜椒、生菜。",
         "nutrition":{"calories":420,"protein":15,"fat":12,"carbs":62,"fiber":10,"sodium":540,"sugar":6},"allergens":["麩質"]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d003",
      "name": "老張健康滷（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。少油少鹽的中藥滷味，營業到半夜。",
      "phone": "02-0000-0003", "address": "台北市中山區南京東路二段（示範地址）", "lat": 25.052, "lng": 121.534,
      "cover": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
      "open": "11:00", "close": "01:00", "closedDays": [],
      "pickup": true, "delivery": false, "deliveryFee": 0, "serviceFee": 0, "discount": 0, "minOrder": 0, "prep": 10,
      "products": [
        {"name":"低脂牛腱滷味拼盤","category":"滷味","price":130,"image":"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
         "description":"牛腱、海帶、豆干、青菜。",
         "nutrition":{"calories":320,"protein":30,"fat":10,"carbs":15,"fiber":2,"sodium":850,"sugar":4},"allergens":["大豆"]},
        {"name":"滷雞腿便當","category":"便當","price":150,"options":"bento",
         "description":"去皮滷雞腿、三樣青菜、白飯。",
         "nutrition":{"calories":620,"protein":38,"fat":20,"carbs":68,"fiber":5,"sodium":920,"sugar":5},"allergens":[]},
        {"name":"綜合蔬菜滷味","category":"滷味","price":90,
         "description":"高麗菜、花椰菜、玉米筍、香菇、豆干。",
         "nutrition":{"calories":180,"protein":10,"fat":6,"carbs":20,"fiber":6,"sodium":700,"sugar":5},"allergens":["大豆"]},
        {"name":"滷蛋","category":"加點","price":15,
         "description":"",
         "nutrition":{"calories":75,"protein":6,"fat":5,"carbs":1,"fiber":0,"sodium":210,"sugar":1},"allergens":["蛋"]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d004",
      "name": "Halo Poke（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。夏威夷波奇碗。",
      "phone": "02-0000-0004", "address": "台北市大安區復興南路一段（示範地址）", "lat": 25.039, "lng": 121.544,
      "cover": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
      "open": "11:00", "close": "20:00", "closedDays": [1],
      "pickup": true, "delivery": true, "deliveryFee": 30, "serviceFee": 15, "discount": 10, "minOrder": 0, "prep": 15,
      "products": [
        {"name":"炙燒鮭魚波奇碗","category":"波奇碗","price":190,"options":"bowl","image":"https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
         "description":"炙燒鮭魚、壽司飯、毛豆、海帶芽、小黃瓜。",
         "nutrition":{"calories":480,"protein":28,"fat":12,"carbs":55,"fiber":5,"sodium":620,"sugar":7},"allergens":["海鮮","大豆"]},
        {"name":"鮪魚酪梨波奇碗","category":"波奇碗","price":210,"options":"bowl",
         "description":"生食級鮪魚、酪梨、紫米飯。",
         "nutrition":{"calories":520,"protein":30,"fat":18,"carbs":52,"fiber":7,"sodium":580,"sugar":5},"allergens":["海鮮"]},
        {"name":"豆腐毛豆素食碗","category":"波奇碗","price":160,"options":"bowl",
         "description":"香煎板豆腐、毛豆、玉米、紫甘藍。",
         "nutrition":{"calories":410,"protein":22,"fat":14,"carbs":48,"fiber":9,"sodium":480,"sugar":6},"allergens":["大豆"]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d005",
      "name": "Burger Fit（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。低碳水漢堡。",
      "phone": "02-0000-0005", "address": "台北市信義區基隆路一段（示範地址）", "lat": 25.044, "lng": 121.56,
      "cover": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
      "open": "11:30", "close": "22:30", "closedDays": [],
      "pickup": true, "delivery": true, "deliveryFee": 35, "serviceFee": 15, "discount": 0, "minOrder": 200, "prep": 20,
      "products": [
        {"name":"增肌牛肉漢堡（無麵包）","category":"漢堡","price":200,"image":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
         "description":"100% 牛肉排用生菜包起來，低碳水。",
         "nutrition":{"calories":520,"protein":45,"fat":25,"carbs":10,"fiber":3,"sodium":680,"sugar":4},"allergens":["奶"]},
        {"name":"雞胸全麥堡","category":"漢堡","price":170,
         "description":"烤雞胸、全麥麵包、番茄、生菜。",
         "nutrition":{"calories":450,"protein":38,"fat":11,"carbs":48,"fiber":6,"sodium":720,"sugar":6},"allergens":["麩質","蛋"]},
        {"name":"烤地瓜薯條","category":"配餐","price":60,
         "description":"不油炸，烤箱烤製。",
         "nutrition":{"calories":190,"protein":2,"fat":5,"carbs":34,"fiber":4,"sodium":180,"sugar":9},"allergens":[]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d006",
      "name": "Green Day（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。蔬食沙拉與湯品。",
      "phone": "02-0000-0006", "address": "台北市松山區民生東路三段（示範地址）", "lat": 25.058, "lng": 121.545,
      "cover": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
      "open": "09:00", "close": "19:00", "closedDays": [0, 6],
      "pickup": true, "delivery": true, "deliveryFee": 30, "serviceFee": 12, "discount": 0, "minOrder": 0, "prep": 15,
      "products": [
        {"name":"義式烤蔬菜溫沙拉","category":"沙拉","price":150,"options":"bowl","image":"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
         "description":"櫛瓜、甜椒、茄子、蘑菇，橄欖油烤製。",
         "nutrition":{"calories":280,"protein":12,"fat":15,"carbs":30,"fiber":9,"sodium":320,"sugar":8},"allergens":[]},
        {"name":"藜麥鷹嘴豆沙拉","category":"沙拉","price":160,"options":"bowl",
         "description":"三色藜麥、鷹嘴豆、小番茄、芝麻葉。",
         "nutrition":{"calories":360,"protein":15,"fat":12,"carbs":48,"fiber":11,"sodium":290,"sugar":6},"allergens":[]},
        {"name":"每日蔬菜湯","category":"湯品","price":80,
         "description":"每天不同的季節蔬菜濃湯，不加奶油。",
         "nutrition":{"calories":110,"protein":4,"fat":3,"carbs":18,"fiber":5,"sodium":420,"sugar":7},"allergens":[]}
      ]
    },
    {
      "demo": "00000000-0000-4000-8000-00000000d007",
      "name": "Yogurt House（示範）",
      "description": "示範店家：用來體驗點餐流程，訂單不會真的製作。優格碗與咖啡。",
      "phone": "02-0000-0007", "address": "台北市松山區南京東路三段（示範地址）", "lat": 25.052, "lng": 121.546,
      "cover": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
      "open": "08:00", "close": "23:00", "closedDays": [],
      "pickup": true, "delivery": true, "deliveryFee": 30, "serviceFee": 10, "discount": 0, "minOrder": 0, "prep": 10,
      "products": [
        {"name":"希臘優格高蛋白碗","category":"優格碗","price":140,"image":"https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80",
         "description":"希臘優格、燕麥脆片、香蕉、奇亞籽。",
         "nutrition":{"calories":350,"protein":25,"fat":5,"carbs":40,"fiber":5,"sodium":120,"sugar":18},"allergens":["奶","麩質"]},
        {"name":"莓果燕麥優格杯","category":"優格碗","price":110,
         "description":"無糖優格、藍莓、草莓、燕麥。",
         "nutrition":{"calories":260,"protein":13,"fat":4,"carbs":42,"fiber":5,"sodium":90,"sugar":20},"allergens":["奶","麩質"]},
        {"name":"無糖拿鐵","category":"咖啡","price":70,"options":"milk",
         "description":"中焙咖啡豆，可以換燕麥奶。",
         "nutrition":{"calories":140,"protein":8,"fat":7,"carbs":11,"fiber":0,"sodium":110,"sugar":11},"allergens":["奶"]}
      ]
    }
  ]$json$;
begin
  select id into v_owner from auth.users where lower(email) = lower(btrim(v_owner_email));
  if v_owner is null then
    raise exception '找不到帳號 %，請先在網站上註冊，再把 v_owner_email 換成你的 Email', v_owner_email;
  end if;

  for v_store in select value from jsonb_array_elements(v_stores)
  loop
    if coalesce((v_store ->> 'self')::boolean, false) then
      v_store_owner := v_owner;
    else
      v_store_owner := (v_store ->> 'demo')::uuid;
      -- 示範帳號：沒有密碼，無法登入，只用來掛示範店家
      -- 文字欄位填空字串而不是 null，Supabase 後台的使用者清單才能正常顯示
      insert into auth.users (
        instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_store_owner, 'authenticated', 'authenticated',
        'demo-store-' || right(v_store ->> 'demo', 4) || '@healthgenie.invalid',
        jsonb_build_object('display_name', '示範店家帳號'), now(), now(),
        '', '', '', ''
      )
      on conflict (id) do nothing;
    end if;

    -- 已經有店家的帳號就跳過，不覆蓋你自己建立的資料
    if exists (select 1 from public.merchants where owner_id = v_store_owner) then
      continue;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('day', d, 'open', v_store ->> 'open', 'close', v_store ->> 'close') order by d), '[]'::jsonb)
      into v_hours
      from generate_series(0, 6) as d
     where not (v_store -> 'closedDays') @> to_jsonb(d);

    insert into public.merchants (
      owner_id, name, description, phone, address, lat, lng, cover_image_url, opening_hours,
      pickup_enabled, delivery_enabled, delivery_fee, service_fee, discount, min_order_amount, prep_minutes,
      accepting_orders, status, review_note
    ) values (
      v_store_owner, v_store ->> 'name', v_store ->> 'description', v_store ->> 'phone', v_store ->> 'address',
      (v_store ->> 'lat')::double precision, (v_store ->> 'lng')::double precision, coalesce(v_store ->> 'cover', ''), v_hours,
      (v_store ->> 'pickup')::boolean, (v_store ->> 'delivery')::boolean,
      (v_store ->> 'deliveryFee')::int, (v_store ->> 'serviceFee')::int, (v_store ->> 'discount')::int,
      (v_store ->> 'minOrder')::int, (v_store ->> 'prep')::int,
      true, 'approved', '示範資料'
    ) returning id into v_merchant;

    v_sort := 0;
    for v_product in select value from jsonb_array_elements(v_store -> 'products')
    loop
      insert into public.products (merchant_id, name, description, category, price, image_url, nutrition, allergens, option_groups, sort_order)
      values (
        v_merchant, v_product ->> 'name', coalesce(v_product ->> 'description', ''), v_product ->> 'category',
        (v_product ->> 'price')::int, coalesce(v_product ->> 'image', ''), v_product -> 'nutrition',
        array(select jsonb_array_elements_text(v_product -> 'allergens')),
        case v_product ->> 'options'
          when 'bento' then v_bento_options
          when 'bowl' then v_bowl_options
          when 'drink' then v_drink_options
          when 'milk' then v_milk_options
          else '[]'::jsonb
        end,
        v_sort
      );
      v_sort := v_sort + 1;
    end loop;
    v_created := v_created + 1;
  end loop;

  raise notice '完成：新增 % 間店家', v_created;
end
$seed$;
