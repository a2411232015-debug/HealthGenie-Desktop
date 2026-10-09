// 刪除帳號（Supabase Edge Function）
// 1. 用會員自己的登入憑證確認身分
// 2. 以會員身分呼叫 prepare_account_deletion()：檢查能否刪除，並清除健康紀錄、訂單上的姓名電話地址
// 3. 用伺服器端的管理金鑰刪除登入帳號（這把金鑰只存在 Supabase，不會出現在網頁）

export interface Env {
  get(name: string): string | undefined;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });

export const handleRequest = async (request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = env.get('SUPABASE_URL');
  const serviceKey = env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = env.get('SUPABASE_ANON_KEY') || request.headers.get('apikey') || '';
  if (!supabaseUrl || !serviceKey) return json({ error: '平台尚未完成設定' }, 503);

  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/.test(authorization)) return json({ error: '請先登入' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: '請求格式錯誤' }, 400);
  }
  if (body.action !== 'delete_account') return json({ error: '不支援的動作' }, 400);

  const userResponse = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey: apiKey } });
  if (!userResponse.ok) return json({ error: '登入已過期，請重新登入' }, 401);
  const user = await userResponse.json().catch(() => null);
  const userId = typeof user?.id === 'string' ? user.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: '登入已過期，請重新登入' }, 401);

  const prepare = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/prepare_account_deletion`, {
    method: 'POST',
    headers: { Authorization: authorization, apikey: apiKey, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!prepare.ok) {
    const detail = await prepare.json().catch(() => null);
    return json({ error: typeof detail?.message === 'string' ? detail.message : '目前無法刪除帳號' }, prepare.status === 401 ? 401 : 409);
  }

  const removal = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!removal.ok) {
    console.error('delete user failed', removal.status, await removal.text().catch(() => ''));
    return json({ error: '個人資料已清除，但刪除登入帳號失敗，請稍後再試一次' }, 502);
  }
  return json({ ok: true });
};
