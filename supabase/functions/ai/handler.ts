// AI 營養估算（Supabase Edge Function）
// Gemini 金鑰只存在 Supabase 的 Secrets，不會出現在網頁原始碼。
// 每次呼叫前會用登入者的身分執行 consume_ai_quota()，未登入或超過每日次數會被擋下。

export interface Env {
  get(name: string): string | undefined;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_IMAGE_BASE64 = 4_500_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: '食物名稱（繁體中文）' },
    calories: { type: 'NUMBER', description: '總熱量 kcal' },
    protein: { type: 'NUMBER', description: '蛋白質 g' },
    fat: { type: 'NUMBER', description: '脂肪 g' },
    carbs: { type: 'NUMBER', description: '碳水化合物 g' },
    fiber: { type: 'NUMBER', description: '膳食纖維 g' },
    sodium: { type: 'NUMBER', description: '鈉 mg' },
    advice: { type: 'STRING', description: '一句繁體中文的飲食建議，30 字以內' },
  },
  required: ['name', 'calories', 'protein', 'fat', 'carbs'],
};

const clamp = (value: unknown, max: number): number => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(0, Math.round(number * 10) / 10));
};

const buildPrompt = (action: string, name: string, description: string): string => {
  if (action === 'estimate_dish') {
    return [
      '你是台灣的營養師。請估算以下這道餐點「一份」的營養成分，數字請合理、偏保守，使用台灣常見份量。',
      `餐點名稱：${name}`,
      description ? `餐點介紹：${description}` : '',
      '如果有附照片，請一併參考照片中的份量。只回傳 JSON。',
    ].filter(Boolean).join('\n');
  }
  return '你是台灣的營養師。請辨識照片中的食物，估算整份的熱量與營養成分，name 用繁體中文寫出食物名稱，advice 給一句實用的飲食建議。只回傳 JSON。';
};

export const handleRequest = async (request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const geminiKey = env.get('GEMINI_API_KEY');
  const supabaseUrl = env.get('SUPABASE_URL');
  if (!geminiKey || !supabaseUrl) return json({ error: '平台尚未設定 AI 服務' }, 503);

  const authorization = request.headers.get('Authorization') || '';
  const apiKey = env.get('SUPABASE_ANON_KEY') || request.headers.get('apikey') || '';
  if (!/^Bearer\s+\S+/.test(authorization)) return json({ error: '請先登入' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: '請求格式錯誤' }, 400);
  }
  const action = String(body.action || '');
  if (action !== 'analyze_food_photo' && action !== 'estimate_dish') return json({ error: '不支援的動作' }, 400);
  const image = typeof body.image === 'string' ? body.image : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  const name = String(body.name || '').trim().slice(0, 50);
  const description = String(body.description || '').trim().slice(0, 300);
  if (action === 'analyze_food_photo' && !image) return json({ error: '請提供照片' }, 400);
  if (action === 'estimate_dish' && !name) return json({ error: '請提供餐點名稱' }, 400);
  if (image && (image.length > MAX_IMAGE_BASE64 || !IMAGE_TYPES.has(mimeType) || !/^[A-Za-z0-9+/=]+$/.test(image))) {
    return json({ error: '照片格式不正確或太大' }, 400);
  }

  // 用登入者的身分扣除每日額度（同時驗證登入狀態）
  const quota = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
    method: 'POST',
    headers: { Authorization: authorization, apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_daily_limit: Number(env.get('AI_DAILY_LIMIT') || 30) }),
  });
  if (quota.status === 401 || quota.status === 403) return json({ error: '請先登入' }, 401);
  if (!quota.ok) return json({ error: 'AI 服務暫時無法使用' }, 502);
  if ((await quota.json()) !== true) return json({ error: '今天的 AI 使用次數已用完，明天再試試看' }, 429);

  const model = env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const parts: Record<string, unknown>[] = [];
  if (image) parts.push({ inlineData: { mimeType, data: image } });
  parts.push({ text: buildPrompt(action, name, description) });

  let response: Response;
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
      }),
    });
  } catch {
    return json({ error: '無法連線到 AI 服務' }, 502);
  }
  if (!response.ok) {
    console.error('Gemini error', response.status, await response.text().catch(() => ''));
    return json({ error: 'AI 服務暫時無法使用，請稍後再試' }, 502);
  }

  try {
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === 'string')?.text || '';
    const result = JSON.parse(text);
    if (!result || typeof result !== 'object' || !result.name) throw new Error('empty');
    return json({
      name: String(result.name).slice(0, 60),
      calories: clamp(result.calories, 5000),
      protein: clamp(result.protein, 500),
      fat: clamp(result.fat, 500),
      carbs: clamp(result.carbs, 1000),
      ...(result.fiber !== undefined ? { fiber: clamp(result.fiber, 200) } : {}),
      ...(result.sodium !== undefined ? { sodium: clamp(result.sodium, 20000) } : {}),
      advice: String(result.advice || '').slice(0, 100),
    });
  } catch {
    return json({ error: 'AI 無法辨識，請換一張清楚的照片或改用手動輸入' }, 422);
  }
};
