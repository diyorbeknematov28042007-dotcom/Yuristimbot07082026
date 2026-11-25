import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker/index';
import { UserState } from '../worker/state';
import { Database, escapeHtml, price } from '../worker/db';
import type { Env } from '../worker/db';
import type { Update } from 'grammy/types';
vi.mock('../worker/bot', async importOriginal => {
  const original = await importOriginal<typeof import('../worker/bot')>();
  return { ...original, createBot: (_env: Env, _db: Database, getSession: () => import('../worker/bot').Session | null) => ({
    init: async () => {}, handleUpdate: async () => { const session=getSession(); if(session) {session.step='chatting';session.draft.category=`${session.draft.category??''}x`;} }
  }) };
});

const env = (state?: unknown): Env => ({
  BOT_TOKEN:'123:test',WEBHOOK_SECRET:'secret',SUPABASE_URL:'https://example.supabase.co',SUPABASE_KEY:'test',
  USER_STATE: {getByName: () => state} as unknown as Env['USER_STATE']
});
const update = (id: number, text='/start'): Update => ({update_id:id,message:{message_id:id,date:1,chat:{id:42,type:'private' as const,first_name:'Test'},from:{id:42,is_bot:false,first_name:'Test'},text}});
const webhook = (id: number, secret='secret') => new Request('https://worker.test/webhook',{
  method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(update(id))
});
afterEach(()=>vi.unstubAllGlobals());

describe('webhook boundary',()=>{
  it('exposes a minimal health check and refuses unauthenticated or malformed requests',async()=>{
    expect((await worker.fetch(new Request('https://worker.test/health'),env())).status).toBe(200);
    expect((await worker.fetch(webhook(1,'wrong'),env())).status).toBe(401);
    expect((await worker.fetch(new Request('https://worker.test/webhook',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'secret','Content-Type':'application/json'},body:'{}'}),env())).status).toBe(400);
    expect((await worker.fetch(new Request('https://worker.test/webhook'),env())).status).toBe(404);
  });
  it('routes by actor, acknowledges duplicates and retries failures',async()=>{
    const process=vi.fn().mockResolvedValueOnce('ok').mockResolvedValueOnce('duplicate').mockRejectedValueOnce(new Error('down'));
    const e=env({process});
    expect((await worker.fetch(webhook(1),e)).status).toBe(200);
    expect((await worker.fetch(webhook(1),e)).status).toBe(200);
    expect((await worker.fetch(webhook(2),e)).status).toBe(503);
    expect(process).toHaveBeenCalledTimes(3);
  });
});

describe('input and atomic claim',()=>{
  it('escapes arbitrary legal text and rejects malformed prices',()=>{
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
    expect(price('12abc')).toBeNull();expect(price('-1')).toBeNull();expect(price('120')).toBe(120);
  });
  it('allows exactly one competing lawyer to claim an active ad',async()=>{
    let active=true;
    vi.stubGlobal('fetch',vi.fn(async (url:URL,options:RequestInit)=>{
      expect(url.searchParams.get('status')).toBe('eq.active');
      expect(options.method).toBe('PATCH');
      const winner=active;active=false;
      return Response.json(winner?[{request_code:'#ABC123',user_id:42,status:'accepted'}]:[]);
    }));
    const db=new Database(env());
    const result=await Promise.all([db.claimAd('#ABC123',100),db.claimAd('#ABC123',200)]);
    expect(result.filter(Boolean)).toHaveLength(1);
  });
});

describe('Durable Object persistence and flood control',()=>{
  it('retains session across updates and de-duplicates delivery',async()=>{
    const ids=new Set<number>();let state:unknown;let rate:{window:number;count:number}|undefined;
    const sql={exec:(query:string,...args:unknown[])=>{
      if(query.startsWith('SELECT id FROM updates'))return {toArray:()=>ids.has(args[0] as number)?[{id:args[0]}]:[]};
      if(query.startsWith('SELECT window,count FROM rate'))return {toArray:()=>rate?[rate]:[]};
      if(query.startsWith('INSERT INTO rate'))rate={window:args[0] as number,count:args[1] as number};
      if(query.startsWith('INSERT INTO updates')) ids.add(args[0] as number);
      if(query.startsWith('DELETE FROM updates WHERE id')) ids.delete(args[0] as number);
      return {toArray:()=>[]};
    }};
    const ctx={storage:{sql,get:async()=>state,put:async(_key:string,value:unknown)=>{state=value;}},blockConcurrencyWhile:(fn:()=>Promise<void>)=>{void fn();}};
    const e=env();
    const obj=new UserState(ctx as unknown as DurableObjectState,e);
    expect(await obj.process(update(1))).toBe('ok');
    expect(await obj.process(update(1))).toBe('duplicate');
    expect(ids.size).toBe(1);
    expect(state).toMatchObject({step:'chatting',model:'gemini-2.5-flash',draft:{category:'x'}});
    const restarted=new UserState(ctx as unknown as DurableObjectState,e);
    expect(await restarted.process(update(2))).toBe('ok');
    expect(state).toMatchObject({draft:{category:'xx'}});
    for(let id=3;id<=8;id++)expect(await restarted.process(update(id))).toBe('ok');
    expect(await restarted.process(update(9))).toBe('limited');
  });
});
