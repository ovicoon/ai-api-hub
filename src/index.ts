import { Ai } from '@cloudflare/ai';

// 환경 변수 및 바인딩 타입 정의
export interface Env {
  AI: any;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ai = new Ai(env.AI);

    try {
      const response = await ai.run('@cf/meta/llama-3.2-1b-instruct' as any, {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: '안녕? 클라우드플레어 워커와 TypeScript에 대해 간단히 소개해줘.' }
        ]
      });

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