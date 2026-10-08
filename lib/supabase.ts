import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
).trim();

export const isSupabaseConfigured = /^https?:\/\//.test(supabaseUrl) && supabaseKey.length > 10;

let client: SupabaseClient | null = null;

export const supabase = (): SupabaseClient => {
  if (!isSupabaseConfigured) throw new Error('尚未設定 Supabase 連線');
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        // PKCE 會把登入結果放在 ?code=，不會跟網址 # 後面的頁面路徑衝突
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'healthgenie-auth',
      },
    });
  }
  return client;
};

/** 登入／重設密碼信件連結要導回的網址（目前網頁，不含 # 與 ?） */
export const appBaseUrl = (): string => `${window.location.origin}${window.location.pathname}`;
