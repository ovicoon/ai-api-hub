import { Ai } from '@cloudflare/ai';

export interface Env {
  AI: any;
  BACKEND_API_KEY: string;
  GEMINI_API_KEY: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// /api/worker-ai : Cloudflare Workers AI
async function handleWorkerAi(body: any, env: Env): Promise<Response> {
  const prompt = body.prompt || body.question;
  if (!prompt) {
    return json({ error: 'Missing required field: prompt (or question)' }, 400);
  }

  const model = body.model || '@cf/meta/llama-3.2-1b-instruct';
  const systemInstruction = body.system || 'You are a helpful assistant.';

  const aiOptions: any = {
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ]
  };

  if (body.temperature !== undefined) {
    aiOptions.temperature = Number(body.temperature);
  }
  if (body.top_p !== undefined) {
    aiOptions.top_p = Number(body.top_p);
  }

  const ai = new Ai(env.AI);
  const response = await ai.run(model as any, aiOptions);
  return json(response);
}

// /api/gemini : Google Gemini API
async function handleGemini(body: any, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Server misconfigured: GEMINI_API_KEY is not set' }, 500);
  }

  const prompt = body.prompt || body.question;
  if (!prompt) {
    return json({ error: 'Missing required field: prompt (or question)' }, 400);
  }

  const model = body.model || DEFAULT_GEMINI_MODEL;
  const systemInstruction = body.system || 'You are a helpful assistant.';

  const payload: any = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: String(prompt) }] }]
  };

  const generationConfig: any = {};
  if (body.temperature !== undefined) {
    generationConfig.temperature = Number(body.temperature);
  }
  if (body.top_p !== undefined) {
    generationConfig.topP = Number(body.top_p);
  }
  if (body.max_tokens !== undefined) {
    generationConfig.maxOutputTokens = Number(body.max_tokens);
  }
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  const res = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data) {
    return json({ error: data?.error?.message || `Gemini API error (${res.status})` }, res.ok ? 502 : res.status);
  }

  const completion = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p.text ?? '')
    .join('');

  return json({ completion, model, usage: data.usageMetadata, raw: data });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

    // 1. API 키 인증 검증
    const clientKey = request.headers.get('X-API-Key');
    if (!clientKey || clientKey !== env.BACKEND_API_KEY) {
      return json({ error: 'Unauthorized: Invalid or missing API key' }, 401);
    }

    // 2. 라우팅
    const { pathname } = new URL(request.url);
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const handler = path === '/api/gemini' ? handleGemini
      : path === '/api/worker-ai' ? handleWorkerAi
      : null;

    if (!handler) {
      return json({ error: 'Not found. Use /api/gemini or /api/worker-ai.' }, 404);
    }

    // 3. POST 요청 확인
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed. Use POST method.' }, 405);
    }

    try {
      const body: any = await request.json();
      return await handler(body, env);
    } catch (error: any) {
      return json({ error: error.message }, 500);
    }
  },
};
