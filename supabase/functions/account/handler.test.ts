// 執行：npm test
import { describe, expect, test } from 'vitest';
import { handleRequest } from './handler';

const USER_ID = '6d8cfad6-af8f-49e8-8a20-efb6bf5cba4d';
const env = { get: (name: string) => ({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' } as Record<string, string>)[name] };
const request = (body: unknown = { action: 'delete_account' }, headers: Record<string, string> = { Authorization: 'Bearer user-token' }) =>
  new Request('https://fn.test/account', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const fake = (responses: { user?: Response; prepare?: Response; remove?: Response }) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) return responses.user || new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    if (url.includes('prepare_account_deletion')) return responses.prepare || new Response('true', { status: 200 });
    return responses.remove || new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe('account edge function', () => {
  test('未登入回 401，不會呼叫任何服務', async () => {
    const { impl, calls } = fake({});
    expect((await handleRequest(request(undefined, {}), env, impl)).status).toBe(401);
    expect(calls.length).toBe(0);
  });

  test('登入憑證無效回 401', async () => {
    const { impl, calls } = fake({ user: new Response('{}', { status: 401 }) });
    expect((await handleRequest(request(), env, impl)).status).toBe(401);
    expect(calls.length).toBe(1);
  });

  test('資料庫拒絕時回傳原因，且不會刪除帳號', async () => {
    const { impl, calls } = fake({ prepare: new Response(JSON.stringify({ message: '你還有進行中的訂單' }), { status: 400 }) });
    const response = await handleRequest(request(), env, impl);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('你還有進行中的訂單');
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(false);
  });

  test('成功時用伺服器金鑰刪除本人的帳號', async () => {
    const { impl, calls } = fake({});
    const response = await handleRequest(request(), env, impl);
    expect(response.status).toBe(200);
    const removal = calls.find((call) => call.init?.method === 'DELETE')!;
    expect(removal.url).toBe(`https://demo.supabase.co/auth/v1/admin/users/${USER_ID}`);
    expect((removal.init?.headers as Record<string, string>).Authorization).toBe('Bearer service-secret');
    const prepare = calls.find((call) => call.url.includes('prepare_account_deletion'))!;
    expect((prepare.init?.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
  });

  test('不支援的動作回 400', async () => {
    const { impl } = fake({});
    expect((await handleRequest(request({ action: 'delete_everyone' }), env, impl)).status).toBe(400);
  });
});
