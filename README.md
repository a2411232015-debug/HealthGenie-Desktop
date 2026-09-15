# HealthGenie AI

HealthGenie 是以 React 19、TypeScript 與 Vite 建立的健康餐點與商家訂單管理示範系統。

## 功能重點

- 安全營養數字轉換，不顯示 `NaN`、`undefined` 或 `null`
- 商品基本價、規格加價、加料加價、單價與小計共用同一套計算
- 單一商家購物車與跨店清空確認
- 顧客端／商家端共用訂單資料與狀態歷程
- 商家餐點規格、加料、售完與暫停接單管理
- `clientRequestId` 防止快速連點重複下單
- Supabase PostgreSQL 雲端資料庫、Row Level Security 與即時同步
- 未設定雲端環境時自動使用版本化 LocalStorage Repository
- 商家最近七天四指標折線圖
- 欄位層級驗證、Toast 與危險操作確認

## 啟動方式

需求：Node.js 18 以上。

```bash
npm install
npm run dev
```

依終端顯示的網址開啟（預設通常為 `http://localhost:3000`）。

## 正式建置

```bash
npm run build
npm run preview
```

## Windows 桌面版

執行 npm run dist:win 可建立能直接雙擊啟動的 64 位元 Windows 可攜版。

輸出檔案位於 release/HealthGenie-1.0.0-portable.exe。執行檔內含前端資源，不需要另外啟動 Vite 或安裝 Node.js。

開發期間可執行 npm run desktop，在 Electron 視窗中測試桌面版。

若要啟用 Gemini 圖片分析，請建立 `.env.local`：

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

未設定 API Key 不會阻擋購物、訂單與商家管理功能；使用 AI 功能時會顯示明確提示。

## 本機資料

主要資料以版本化格式保存在：

- `healthgenie_user`
- `healthgenie_cart`
- `healthgenie_merchants`
- `healthgenie_products`
- `healthgenie_orders`
- `healthgenie_analytics`

## Supabase 資料庫

專案已提供 PostgreSQL migration 與前端同步層。雲端連線未設定或暫時失敗時，畫面仍會使用 LocalStorage，不會阻擋既有功能。

1. 在 Supabase 建立一個新專案。
2. 到 **Authentication → Providers → Anonymous Sign-Ins** 啟用匿名登入。
3. 開啟 **SQL Editor**，執行 `supabase/migrations/202609080001_healthgenie_schema.sql`。
4. 複製 `.env.example` 為 `.env.local`，填入 Supabase Project URL 與 anon key：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

5. 重新執行 `npm run dev`。

首次成功連線會將目前瀏覽器內的使用者、購物車、商家、餐點、訂單及分析資料匯入 PostgreSQL。之後相同匿名帳號的多個分頁會透過 Supabase Realtime 同步更新。

資料表包括：

- `profiles`
- `carts`
- `merchants`
- `products`
- `orders`
- `analytics_events`

所有資料表皆已啟用 Row Level Security，只允許目前登入身分讀寫自己的資料。正式提供跨裝置使用時，建議再加入 Email、Google 或手機登入，讓同一使用者能在不同裝置取得相同資料。
