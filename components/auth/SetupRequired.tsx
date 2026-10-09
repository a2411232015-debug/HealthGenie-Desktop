import React from 'react';
import { Activity, Database } from 'lucide-react';

/** 還沒設定 Supabase 時顯示的說明頁（點餐平台需要雲端資料庫才能讓顧客和店家互相看到資料） */
export const SetupRequired: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-2 text-2xl font-black text-teal-700">
        <span className="rounded-lg bg-teal-600 p-1 text-white"><Activity className="h-5 w-5" /></span>
        HealthGenie
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-800">
        <Database className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">
          點餐平台需要連接雲端資料庫（Supabase），顧客和店家才能看到同一份菜單和訂單。目前還沒有設定連線資訊。
        </p>
      </div>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        <li>到 supabase.com 建立免費專案。</li>
        <li>在 SQL Editor 依序執行 <code className="rounded bg-slate-100 px-1">supabase/migrations</code> 資料夾裡的檔案。</li>
        <li>複製 <code className="rounded bg-slate-100 px-1">.env.example</code> 成 <code className="rounded bg-slate-100 px-1">.env.local</code>，填入 Project URL 與 Publishable key。</li>
        <li>重新執行 <code className="rounded bg-slate-100 px-1">npm run dev</code>。</li>
      </ol>
      <p className="mt-6 text-xs text-slate-400">完整步驟請看專案的 README.md。</p>
    </div>
  </div>
);
