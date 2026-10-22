import { Ai } from '@cloudflare/ai';

export interface Env {
  AI: any;
  MY_SECRET_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    
    // 1. API 키 인증 검증
    const clientKey = request.headers.get('X-API-Key');
    if (!clientKey || clientKey !== env.MY_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // 2. POST 요청 확인
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Use POST method.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    try {
      // 클라이언트가 보낸 JSON 본문 파싱
      const body: any = await request.json();

      // 3. 필수 값(질문/프롬프트) 검증
      const prompt = body.prompt || body.question;
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Missing required field: prompt (or question)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 4. 파라미터별 기본값 설정 (값이 없으면 기본값 적용)
      const model = body.model || '@cf/meta/llama-3.2-1b-instruct';
      const systemInstruction = body.system || 'You are a helpful assistant.';

      // AI 실행 옵션 객체 구성
      const aiOptions: any = {
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      };

      // temperature 값이 전달되었다면 추가
      if (body.temperature !== undefined) {
        aiOptions.temperature = Number(body.temperature);
      }

      // top_p 값이 전달되었다면 추가
      if (body.top_p !== undefined) {
        aiOptions.top_p = Number(body.top_p);
      }

      // 5. Cloudflare Workers AI 실행
      const ai = new Ai(env.AI);
      const response = await ai.run(model as any, aiOptions);

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  },
};