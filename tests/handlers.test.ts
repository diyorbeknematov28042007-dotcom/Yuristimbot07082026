import { describe, expect, it, vi } from 'vitest';
import { createBot, initialSession } from '../worker/bot';
import { Database } from '../worker/db';
import type { Env, User } from '../worker/db';
import type { Update } from 'grammy/types';
import type { BotConfig, Context } from 'grammy';

const env: Env={BOT_TOKEN:'123:test',WEBHOOK_SECRET:'secret',DB:{} as D1Database,ADMIN_IDS:'42',USER_STATE:{} as Env['USER_STATE']};
const from={id:42,is_bot:false,first_name:'Test',username:'tester'};
const chat={id:42,type:'private' as const,first_name:'Test'};
const message=(id:number,text:string):Update=>({update_id:id,message:{message_id:id,date:1,chat,from,text,...(text==='/start'?{entities:[{type:'bot_command' as const,offset:0,length:6}]}:{})}});
const callback=(id:number,data:string):Update=>({update_id:id,callback_query:{id:String(id),from,chat_instance:'abc',data,message:{message_id:1,date:1,chat,text:'choose'}}});

describe('Telegram handlers with mocked upstreams',()=>{
  it('keeps registration, role and offer handlers functional',async()=>{
    let user:User|null=null;
    const db=new Database(env.DB);
    vi.spyOn(db,'getUser').mockImplementation(async()=>user);
    vi.spyOn(db,'ensureUser').mockImplementation(async()=>user={telegram_id:42,full_name:'Test',username:'tester',role:'user',bio:null,is_accepted_offer:false});
    vi.spyOn(db,'updateUser').mockImplementation(async(_id,values)=>user={...user!,...values});
    const calls:string[]=[];
    const fetcher:typeof fetch=async input=>{
      const method=String(input).split('/').pop()!;
      calls.push(method);
      if(method==='getMe')return Response.json({ok:true,result:{id:123,is_bot:true,first_name:'Yuristim',username:'test_bot',can_join_groups:true,can_read_all_group_messages:false,supports_inline_queries:false}});
      return Response.json({ok:true,result:{message_id:2,date:1,chat,text:'ok'}});
    };
    let session=initialSession();
    const client={fetch:fetcher} as unknown as NonNullable<BotConfig<Context>['client']>;
    const bot=createBot(env,db,()=>session,client);
    await bot.init();
    await bot.handleUpdate(message(1,'/start'));
    await bot.handleUpdate(callback(2,'role_lawyer'));
    expect((await db.getUser(42))?.role).toBe('lawyer');
    await bot.handleUpdate(callback(3,'accept_offer'));
    expect((await db.getUser(42))?.is_accepted_offer).toBe(true);
    expect(calls).toContain('sendMessage');
    expect(calls).toContain('editMessageText');
    expect(calls).toContain('answerCallbackQuery');
    await bot.handleUpdate(message(4,'🤖 Yuristim AI'));
    expect(session.model).toBe('gemini-3.5-flash-lite');
    await bot.handleUpdate(callback(5,'ai_change_model'));
    expect(session.model).toBe('gemini-3-flash-preview');
    session=initialSession();
  });
});
