// 執行：npm test
import { describe, expect, test } from 'vitest';
import { handleRequest } from './handler';

const env = (values: Record<string, string>) => ({ get: (name: string) => values[name] });
const baseEnv = env({ GEMINI_API_KEY: 'secret-key', SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'anon' });
const request = (body: unknown, headers: Record<string, string> = { Authorization: 'Bearer user-token' }) =>
  new Request('https://fn.test/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const fakeFetch = (quota: { status: number; body: unknown }, gemini?: { status: number; body: unknown }) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('consume_ai_quota')) return new Response(JSON.stringify(quota.body), { status: quota.status });
    return new Response(JSON.stringify(gemini?.body), { status: gemini?.status || 500 });
  }) as unknown as typeof fetch;
  return { impl, calls };
};

const geminiAnswer = (value: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

describe('ai edge function', () => {
  test('OPTIONS 回傳 CORS', async () => {
    const response = await handleRequest(new Request('https://fn.test/ai', { method: 'OPTIONS' }), baseEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('沒有設定金鑰時回 503', async () => {
    const response = await handleRequest(request({ action: 'estimate_dish', name: 'x' }), env({}));
    expect(response.status).toBe(503);
  });

  test('沒有登入時回 401，且不會呼叫 Gemini', async () => {
    const { impl, calls } = fakeFetch({ status: 200, body: true });
    const response = await handleRequest(request({ action: 'estimate_dish', name: '雞胸便當' }, {}), baseEnv, impl);
    expect(response.status).toBe(401);
    expect(calls.length).toBe(0);
  });

  test('資料庫拒絕身分時回 401', async () => {
    const { impl, calls } = fakeFetch({ status: 401, body: { message: 'JWT expired' } });
    const response = await handleRequest(request({ action: 'estimate_dish', name: '雞胸便當' }), baseEnv, impl);
    expect(response.status).toBe(401);
    expect(calls.length).toBe(1);
  });

  test('超過每日額度回 429', async () => {
    const { impl, calls } = fakeFetch({ status: 200, body: false });
    const response = await handleRequest(request({ action: 'estimate_dish', name: '雞胸便當' }), baseEnv, impl);
    expect(response.status).toBe(429);
    expect(calls.length).toBe(1);
  });

  test('照片格式錯誤回 400', async () => {
    const { impl } = fakeFetch({ status: 200, body: true });
    const response = await handleRequest(request({ action: 'analyze_food_photo', image: 'not base64!!', mimeType: 'image/gif' }), baseEnv, impl);
    expect(response.status).toBe(400);
  });

  test('成功時回傳整理過的數字，金鑰只放在 header', async () => {
    const { impl, calls } = fakeFetch({ status: 200, body: true }, { status: 200, body: geminiAnswer({ name: '雞胸肉便當', calories: 512.34, protein: '41', fat: -3, carbs: 60, sodium: 99999, advice: '蛋白質充足' }) });
    const response = await handleRequest(request({ action: 'analyze_food_photo', image: 'aGVsbG8=', mimeType: 'image/jpeg' }), baseEnv, impl);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ name: '雞胸肉便當', calories: 512.3, protein: 41, fat: 0, carbs: 60, sodium: 20000, advice: '蛋白質充足' });
    const geminiCall = calls[1];
    expect(geminiCall.url).not.toContain('secret-key');
    expect((geminiCall.init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
    const sent = JSON.parse(String(geminiCall.init.body));
    expect(sent.contents[0].parts[0].inlineData.data).toBe('aGVsbG8=');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
  });

  test('Gemini 回傳無法解析時回 422', async () => {
    const { impl } = fakeFetch({ status: 200, body: true }, { status: 200, body: { candidates: [{ content: { parts: [{ text: 'sorry' }] } }] } });
    const response = await handleRequest(request({ action: 'estimate_dish', name: '神秘料理' }), baseEnv, impl);
    expect(response.status).toBe(422);
  });

  test('Gemini 錯誤時回 502', async () => {
    const { impl } = fakeFetch({ status: 200, body: true }, { status: 500, body: { error: 'boom' } });
    const response = await handleRequest(request({ action: 'estimate_dish', name: '雞胸便當' }), baseEnv, impl);
    expect(response.status).toBe(502);
  });
});
