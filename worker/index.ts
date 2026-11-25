import type { Update } from 'grammy/types';
import type { Env } from './db';
import { updateActor } from './bot';
export { UserState } from './state';

function safeEquals(a: string,b: string): boolean {
  const bytesA=new TextEncoder().encode(a), bytesB=new TextEncoder().encode(b);
  let diff=bytesA.length ^ bytesB.length;
  for(let i=0;i<Math.max(bytesA.length,bytesB.length);i++) diff|=(bytesA[i]??0)^(bytesB[i]??0);
  return diff===0;
}
async function boundedJson(request: Request): Promise<Update | null> {
  const reader=request.body?.getReader();if(!reader)return null;
  let length=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>262144){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try { return JSON.parse(new TextDecoder().decode(bytes)) as Update; } catch {return null;}
}
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const path=new URL(request.url).pathname;
    if(path==='/health' && request.method==='GET') return Response.json({status:'ok',service:'yuristim-bot'});
    if(path!=='/webhook' || request.method!=='POST') return new Response('Not found',{status:404});
    if(!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.DB) return new Response('Unavailable',{status:503});
    const token=request.headers.get('X-Telegram-Bot-Api-Secret-Token')??'';
    if(!safeEquals(token,env.WEBHOOK_SECRET)) return new Response('Unauthorized',{status:401});
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return new Response('Unsupported media type',{status:415});
    const update=await boundedJson(request);
    if(!update || !Number.isSafeInteger(update.update_id) || update.update_id<0) return new Response('Bad request',{status:400});
    const actor=updateActor(update);
    if(!actor || !Number.isSafeInteger(actor))return new Response('Unsupported update',{status:200});
    try {
      const state=env.USER_STATE.getByName(String(actor)) as DurableObjectStub<import('./state').UserState>;
      const outcome=await state.process(update);
      // Telegram retries non-2xx webhook responses; acknowledge deliberately dropped flood updates.
      return new Response(outcome==='limited'?'Rate limited':'OK',{status:200});
    } catch {
      console.error('Webhook processing failed');
      return new Response('Service unavailable',{status:503});
    }
  }
} satisfies ExportedHandler<Env>;
