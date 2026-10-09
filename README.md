# HealthGenie 健康點餐平台

看得到營養標示的健康餐點點餐平台。顧客可以依熱量需求挑餐點、線上下單自取或外送；店家有自己的後台接單、管理菜單；平台管理員負責審核店家。

## 功能

**顧客**
- 瀏覽已上線的店家、營業狀態、每週營業時間、與自己的距離
- 每道餐點都有營養標示，選規格（例如飯量減半）時熱量與價格即時更新
- 依「今天還能吃多少熱量」、預算、高蛋白、過敏原推薦餐點
- 購物車、自取或外送、現金付款（取餐或送達時付款）
- 預約取餐／送達時間（今天或明天的營業時段），店家休息時也能先預約
- 訂單進度自動更新；店家接單前可自行取消；「再點一次」
- 健康紀錄：每日熱量與三大營養素目標、飲食日誌（手動、AI 拍照估算、訂單一鍵記錄）、體重趨勢
- 可以加到手機主畫面，像 App 一樣開啟
- 隱私權政策、服務條款，並可自行刪除帳號（健康資料刪除、過去訂單去識別化）

**店家**
- 線上申請開店，審核期間就能先建立菜單
- 接單看板：新訂單提示音與桌面通知、接單 → 製作 → 完成 → 收款
- 拒單、取消都要填原因，顧客看得到
- 列印廚房出單（適用 58／80mm 感熱紙印表機或一般印表機）
- 菜單管理：照片上傳、分類、規格與加價、過敏原、AI 幫忙估算營養
- 營業時間（可設定多個時段、跨夜）、暫停接單開關、運費、服務費、折扣、最低消費
- 營運數據：營收、客單價、熱賣餐點、尖峰時段

**平台管理員**
- 審核、退件、停權店家，查看今日訂單數

## 安全設計

- 每個人只看得到自己該看的資料（資料庫的 Row Level Security）：顧客只看得到自己的訂單與健康紀錄，店家只看得到下給自己的訂單
- 下單金額一律由資料庫重新計算，前端改不了價錢；店家改價時，舊價格的訂單會被擋下並提示顧客
- 重複按下單按鈕不會產生兩張訂單
- 店家無法自己核准自己，一般會員無法把自己設成管理員
- Gemini AI 金鑰只存在 Supabase 伺服器端，網頁原始碼裡看不到；每人每天有使用次數上限

## 架構

```
瀏覽器（React + Vite，GitHub Pages 或桌面版）
        │
        ▼
Supabase
  ├─ 資料庫（PostgreSQL + Row Level Security）
  │    ├─ place_order()          下單：重新計價、檢查營業時間與售完
  │    └─ update_order_status()  訂單狀態只能依規則變更
  ├─ 登入（Email 密碼、Google）
  ├─ Storage（餐點照片）
  ├─ Realtime（訂單即時更新）
  ├─ Edge Function「ai」→ Google Gemini
  └─ Edge Function「account」→ 刪除帳號（需要伺服器端管理權限）
```

## 第一次設定（約 20 分鐘）

### 1. 建立 Supabase 專案

到 [supabase.com](https://supabase.com) 註冊並建立新專案（免費方案即可）。

### 2. 建立資料庫

在 Supabase 後台左側選 **SQL Editor**，依序把下列檔案的內容貼上並按 **Run**：

1. `supabase/migrations/202609080001_healthgenie_schema.sql`（之前已經執行過的話可以跳過）
2. `supabase/migrations/202610090001_ordering_platform.sql`

> 如果之前用過舊版，舊的示範資料不會被刪除，而是改名成 `legacy_` 開頭的資料表。確定不需要後可以自行刪除。

### 3. 設定登入

到 **Authentication**：

- **Sign In / Providers**：確認 **Email** 已開啟；**關閉 Anonymous sign-ins**（新版不需要匿名登入）
- **URL Configuration**：
  - Site URL 填網站網址，例如 `https://a2411232015-debug.github.io/HealthGenie-Desktop/`
  - Redirect URLs 加入同一個網址，以及本機測試用的 `http://localhost:3000/`
- （選用）想讓顧客用 Google 登入，在 Providers 開啟 Google 並依 Supabase 的說明填入 Google 的 Client ID

> ⚠️ **關於 Email**：Supabase 內建的寄信服務只會寄給「Supabase 組織成員」的信箱，而且每小時只能寄幾封，一般顧客收不到驗證信。
> - 剛上線時：在 **Sign In / Providers → Email** 把 **Confirm email 關掉**，顧客註冊後就能直接登入。
> - 想讓顧客也能用「忘記密碼」：到 **Authentication → Emails → SMTP Settings** 設定自己的寄信服務（例如 Resend、Brevo，或 Gmail 的應用程式密碼），之後可以再把 Confirm email 打開。

### 4. 把自己設成平台管理員

先在網站上用 Email 註冊一個帳號，然後回到 SQL Editor 執行（把 Email 換成你的）：

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

重新整理網站後，左側選單會出現「平台管理」。

### 5. 開啟 AI 功能（選用）

AI 用來「拍照估算熱量」和「幫店家估算營養標示」。沒設定也不影響點餐。

1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 取得 Gemini API 金鑰
2. 到 Supabase 後台 **Edge Functions → Secrets**，新增名稱 `GEMINI_API_KEY`、值貼上金鑰
3. 部署兩個伺服器函式。可以在後台 **Edge Functions → Deploy a new function** 貼上 `supabase/functions/` 裡的程式並關閉 JWT 驗證，或在電腦上執行（需要已安裝 Node.js）：

```bash
npx supabase login
npx supabase link --project-ref 你的專案ID
npx supabase secrets set GEMINI_API_KEY=你的金鑰
npx supabase functions deploy ai --no-verify-jwt
npx supabase functions deploy account --no-verify-jwt
```

`account` 函式負責「刪除帳號」，沒有部署的話，會員按刪除帳號會失敗。

`--no-verify-jwt` 是安全的：函式本身會透過資料庫確認使用者已登入，並限制每人每天 30 次。可以用 `AI_DAILY_LIMIT` 調整次數、用 `GEMINI_MODEL` 換模型（預設 `gemini-2.5-flash`）。

> ⚠️ 舊版把 Gemini 金鑰放在網頁裡，任何人都看得到。如果你之前有部署過，請到 Google AI Studio **刪除舊金鑰並重新產生**，也把 GitHub Secrets 裡的 `GEMINI_API_KEY` 刪掉。

### 6. 在自己電腦上執行

需求：Node.js 18 以上。

1. 在專案資料夾執行 `npm install`
2. 把 `.env.example` 複製一份，改名為 `.env.local`，打開後填入 Supabase 的 Project URL 與 Publishable key（Supabase 後台 → Project Settings → API）
3. 執行 `npm run dev`

打開終端機顯示的網址（通常是 `http://localhost:3000`）。

### 7. 部署到 GitHub Pages

1. Settings → Pages → Source 選 **GitHub Actions**
2. （選填）Settings → Secrets and variables → Actions → **Variables** 新增 `VITE_OPERATOR_NAME`（營運者名稱）、`VITE_CONTACT_EMAIL`（客服信箱），會顯示在隱私權政策與服務條款
3. Actions → **Build and Deploy** → Run workflow（之後每次更新 `main` 都會自動部署）

`deploy.yml` 已經寫入本專案 Supabase 的網址與 Publishable key（這兩個本來就會出現在網頁裡，可以公開）。如果要換成別的 Supabase 專案，在 **Secrets** 新增 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 就會覆蓋。

## 第一次開店流程

1. 店家註冊帳號 → 左側「成為合作店家」→ 填寫店家資料送出
2. 店家先在「菜單」建立餐點（記得填營養標示）
3. 平台管理員在「平台管理」按「核准上線」
4. 店家在「接單」頁按「開啟新訂單提示音」，保持頁面開著就不會漏單

## 測試

```bash
npm test          # 價格、營業時間、預約時段、伺服器函式的單元測試（38 項）
npm run build     # 型別檢查、正式建置，並檢查輸出（樣式、圖示、沒有夾帶金鑰）
```

資料庫測試（權限、下單、預約、刪除帳號等，共 113 項）在 GitHub Actions 的 **Check** 流程會自動執行，也可以在任何 PostgreSQL 16 上手動跑：

```bash
psql -f supabase/tests/supabase_stub.sql
psql -f supabase/migrations/202609080001_healthgenie_schema.sql
psql -f supabase/migrations/202610090001_ordering_platform.sql
psql -f supabase/tests/platform_test.sql
```

## 上線前請確認

- 隱私權政策與服務條款是通用範本，請依你的實際營運方式調整，必要時請法律專業人士確認
- 設定 `VITE_CONTACT_EMAIL`，讓會員知道怎麼聯絡你
- 店家需自行辦理食品業者登錄與開立發票

## Windows 桌面版

`npm run dist:win` 會產生 `release/HealthGenie-1.0.0-portable.exe`。桌面版適合放在店裡的電腦當接單機；桌面版不支援 Google 登入，請用 Email 登入。建置前一樣需要 `.env.local`。

## 接下來可以做的事（第二階段）

- 線上付款（綠界 ECPay、藍新、LINE Pay）與電子發票
- 地址自動轉座標、外送範圍限制
- 優惠券、評價
- 新訂單 LINE／Telegram 推播
