import { DurableObject } from 'cloudflare:workers';
import type { Update } from 'grammy/types';
import { createBot, initialSession } from './bot';
import type { Session } from './bot';
import { Database } from './db';
import type { Env } from './db';

export class UserState extends DurableObject<Env> {
  private readonly bot;
  private pending: Promise<unknown> = Promise.resolve();
  private currentSession: Session | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx,env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS updates (id INTEGER PRIMARY KEY, received INTEGER NOT NULL)');
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rate (id INTEGER PRIMARY KEY CHECK(id=1), window INTEGER NOT NULL, count INTEGER NOT NULL)');
    });
    this.bot=createBot(env,new Database(env),()=>this.currentSession);
  }
  async process(update: Update): Promise<'ok'|'duplicate'|'limited'> {
    const task = this.pending.then(() => this.processOne(update));
    this.pending=task.catch(() => {});
    return task;
  }
  private async processOne(update: Update): Promise<'ok'|'duplicate'|'limited'> {
    const now=Date.now();
    const sql=this.ctx.storage.sql;
    const already=sql.exec<{id:number}>('SELECT id FROM updates WHERE id=?', update.update_id).toArray();
    if(already.length) return 'duplicate';
    const rate=sql.exec<{window:number;count:number}>('SELECT window,count FROM rate WHERE id=1').toArray()[0];
    const count=rate && now-rate.window<10_000 ? rate.count+1 : 1;
    if(count>8) return 'limited';
    sql.exec('INSERT INTO rate (id,window,count) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET window=excluded.window,count=excluded.count',count===1?now:rate!.window,count);
    sql.exec('INSERT INTO updates (id,received) VALUES (?,?)',update.update_id,now);
    if(update.update_id%64===0) sql.exec('DELETE FROM updates WHERE received<?',now-7*86_400_000);
    const session=await this.ctx.storage.get<Session>('session') ?? initialSession();
    try {
      // Session is scoped to the per-actor Durable Object, never a process global.
      this.currentSession=session;
      await this.bot.init();
      await this.bot.handleUpdate(update);
      await this.ctx.storage.put('session',session);
      return 'ok';
    } catch (e) {
      sql.exec('DELETE FROM updates WHERE id=?',update.update_id);
      console.error('Update processing failed',e instanceof Error?e.name:'unknown');
      throw e;
    } finally {
      this.currentSession=null;
    }
  }
}
