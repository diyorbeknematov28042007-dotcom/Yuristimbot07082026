import { Bot, Context } from 'grammy';
import type { BotConfig } from 'grammy';
import type { Update } from 'grammy/types';
import { askYuristim } from './ai';
import { Database, DuplicateRequestCodeError, escapeHtml, price, requestCode } from './db';
import type { Env, User, Ad } from './db';
import * as k from './keyboards';

export type Step = '' | 'chatting' | 'category' | 'description' | 'price_type' | 'min_price' | 'max_price' | 'bio' | 'admin_category' | 'admin_title_doc' | 'admin_title_article' | 'admin_title_lit' | 'admin_value';
export interface Session {
  step: Step;
  model: 'gemini-3.5-flash-lite' | 'gemini-3-flash-preview';
  draft: { category?: string; description?: string; price_type?: 'agreed' | 'free' | 'exact'; min_price?: number; max_price?: number; contentType?: string; title?: string };
}
export const initialSession = (): Session => ({ step: '', model: 'gemini-3.5-flash-lite', draft: {} });
interface BotContext extends Context { session: Session }
const mainKeyboard = (u: User) => u.role === 'lawyer' ? k.lawyerMain() : k.userMain();
const validText = (text: string | undefined, max = 1500) => typeof text === 'string' && text.trim().length > 0 && text.length <= max;
const isAdmin = (env: Env, id: number) => (env.ADMIN_IDS ?? '').split(',').some(s => Number(s.trim()) === id);
const adLine = (a: Ad) => `${escapeHtml(a.request_code)} — ${escapeHtml(a.category)} (${escapeHtml(a.status)})`;

export function createBot(env: Env, db: Database, sessionSource: () => Session | null, client?: BotConfig<BotContext>['client']): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN, client ? {client} : {});
  bot.catch(err => { console.error('Bot update failed', err.error instanceof Error ? err.error.name : 'unknown'); throw err.error; });
  bot.use(async (ctx,next) => {
    const session=sessionSource();
    if (!session) throw new Error('Missing session');
    ctx.session=session;
    await next();
  });
  const requireUser = async (ctx: BotContext, lawyer = false): Promise<User | null> => {
    if (!ctx.from) return null;
    const user = await db.getUser(ctx.from.id);
    if (!user || !user.is_accepted_offer || (lawyer && user.role !== 'lawyer')) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Avval ro‘yxatdan o‘ting va offertani qabul qiling.', show_alert: true });
      else await ctx.reply('Avval /start orqali ro‘yxatdan o‘ting va offertani qabul qiling.');
      return null;
    }
    return user;
  };
  const finishAd = async (ctx: BotContext) => {
    const user = await requireUser(ctx);
    if (!user || user.role !== 'user') return;
    const d = ctx.session.draft;
    if (!d.category || !d.description || !d.price_type) return;
    // D1's unique request code constraint protects the unlikely code collision.
    let ad: Ad | undefined;
    for (let i = 0; i < 3 && !ad; i++) {
      try { ad = await db.createAd({ request_code: requestCode(), user_id: ctx.from!.id,
        category: d.category, description: d.description, price_type: d.price_type,
        min_price: d.min_price ?? null, max_price: d.max_price ?? null }, ctx.update.update_id); }
      catch (e) { if (!(e instanceof DuplicateRequestCodeError) || i === 2) throw e; }
    }
    if (!ad) return;
    ctx.session.step = ''; ctx.session.draft = {};
    await ctx.reply(`E'loningiz qabul qilindi! ID: ${ad.request_code}\nKanalimizni kuzatib boring: @yuristim_channel`);
    if (env.CHANNEL_ID && /^-?\d+$/.test(env.CHANNEL_ID)) {
      const p = ad.price_type === 'agreed' ? '#kelishiladi' : ad.price_type === 'free' ? '#bepul' : `${ad.min_price} - ${ad.max_price} so'm`;
      const text = `<b>Yangi e'lon: ${escapeHtml(ad.request_code)}</b>\n\n<b>Maqsad:</b> #${escapeHtml(ad.category.replace(/\s+/g, '_'))}\n<b>Tavsif:</b> ${escapeHtml(ad.description)}\n<b>Narx:</b> ${escapeHtml(p)}\n`;
      try { await ctx.api.sendMessage(env.CHANNEL_ID, text, { parse_mode: 'HTML', reply_markup: k.acceptRequest(ad.request_code) }); }
      catch { console.error('Channel delivery failed'); }
    }
  };

  bot.command('start', async ctx => {
    ctx.session = initialSession();
    if (!ctx.from) return;
    await db.ensureUser(ctx.from.id, ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''), ctx.from.username);
    await ctx.reply("<b>Assalomu alaykum, Yuristim botiga xush kelibsiz!</b>\n\nIltimos, botdan foydalanish uchun o'z rolingizni tanlang:", { parse_mode: 'HTML', reply_markup: k.roleSelection() });
  });
  bot.callbackQuery(/^role_(lawyer|user)$/, async ctx => {
    if (!await db.getUser(ctx.from.id)) return ctx.answerCallbackQuery({text:'Avval /start buyrug‘ini yuboring.',show_alert:true});
    const role = ctx.match[1] as 'lawyer' | 'user';
    await db.updateUser(ctx.from.id, { role });
    await ctx.editMessageText(`Siz <b>${role === 'lawyer' ? 'Huquqshunos' : 'Foydalanuvchi'}</b> rolini tanladingiz.\n\nBotdan foydalanish qoidalari bilan tanishib chiqing (Video darslik) va ommaviy offertani qabul qiling:`, {parse_mode:'HTML',reply_markup:k.offer()});
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('accept_offer', async ctx => {
    const user = await db.getUser(ctx.from.id);
    if (!user) return ctx.answerCallbackQuery({text:'Avval /start buyrug‘ini yuboring.',show_alert:true});
    await db.updateUser(ctx.from.id, {is_accepted_offer:true});
    await ctx.reply("✅ Offerta qabul qilindi! Botdan to'liq foydalanishingiz mumkin.", {reply_markup: mainKeyboard(user)});
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage().catch(() => {});
  });
  bot.command('admin', async ctx => {
    if (!ctx.from || !isAdmin(env,ctx.from.id) || !await requireUser(ctx)) return;
    await ctx.reply('Admin panelga xush kelibsiz!', {reply_markup:k.adminPanel()});
  });
  bot.hears('🔙 Orqaga', async ctx => {
    const user = await requireUser(ctx); if (!user) return;
    ctx.session.step = ''; ctx.session.draft = {};
    await ctx.reply('Bosh sahifa', {reply_markup:mainKeyboard(user)});
  });
  bot.hears('🤖 Yuristim AI', async ctx => {
    if (!await requireUser(ctx)) return;
    ctx.session.step = 'chatting'; ctx.session.model = 'gemini-3.5-flash-lite';
    await ctx.reply("🤖 <b>Yuristim AI</b>\n\nJoriy model: Yuristim 1.0 (Tezkor)\nSavolingizni to'g'ridan-to'g'ri yozib yuboring yoki quyidagi imkoniyatlardan foydalaning:", {parse_mode:'HTML',reply_markup:k.aiMenu()});
  });
  bot.callbackQuery('ai_change_model', async ctx => {
    if (!await requireUser(ctx)) return;
    ctx.session.model = ctx.session.model === 'gemini-3.5-flash-lite' ? 'gemini-3-flash-preview' : 'gemini-3.5-flash-lite';
    const name = ctx.session.model === 'gemini-3-flash-preview' ? "1.5 (Chuqur o'y)" : '1.0 (Tezkor)';
    await ctx.editMessageText(`🤖 <b>Yuristim AI</b>\n\nJoriy model: Yuristim ${name}\nSavolingizni yo'llang:`, {parse_mode:'HTML',reply_markup:k.aiMenu()});
    await ctx.answerCallbackQuery({text:`Model ${name} ga o'zgartirildi!`,show_alert:true});
  });
  bot.callbackQuery(/^(ai_doc_analysis|ai_voice_analysis)$/, async ctx => {
    if (!await requireUser(ctx)) return;
    await ctx.answerCallbackQuery({ text: 'Bu funksiya hozircha ishga tushirilmagan.', show_alert: true });
  });
  bot.hears('⚖️ Huquqshunos maslahati', async ctx => {
    const u=await requireUser(ctx); if (!u || u.role!=='user') return;
    ctx.session.step='';
    await ctx.reply("Huquqshunos maslahati bo'limi:",{reply_markup:k.adviceReply()});
    await ctx.reply("O'zingizga kerakli bo'limni tanlang:",{reply_markup:k.advice()});
  });
  bot.callbackQuery('new_ad', async ctx => {
    const u=await requireUser(ctx); if (!u || u.role!=='user') return;
    ctx.session.step='category'; ctx.session.draft={};
    await ctx.reply('Murojaat maqsadi nima? (Masalan: Advokat xizmati, Yuridik maslahat, Hujjat tayyorlash)');
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery('my_ads', async ctx => {
    const u=await requireUser(ctx); if (!u || u.role!=='user') return;
    const ads=await db.adsForUser(ctx.from.id);
    await ctx.reply(ads.length ? ads.map(adLine).join('\n').slice(0,3500) : "Sizda hozircha e'lonlar yo'q.");
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery(/^price_(agreed|free|exact)$/, async ctx => {
    const u=await requireUser(ctx); if (!u || u.role!=='user' || ctx.session.step!=='price_type') return ctx.answerCallbackQuery({text:'Avval yangi e’lon yarating.',show_alert:true});
    const kind=ctx.match[1] as 'agreed'|'free'|'exact'; ctx.session.draft.price_type=kind;
    if(kind==='exact'){ctx.session.step='min_price'; await ctx.reply("Minimal summani kiriting (so'mda):");}
    else await finishAd(ctx);
    await ctx.answerCallbackQuery();
  });
  bot.hears('🔍 Mijoz topish', async ctx => {
    if (!await requireUser(ctx,true)) return;
    ctx.session.step='bio';
    await ctx.reply("O'zingiz haqida qisqacha ma'lumot qoldiring (Tajriba, sohalaringiz):");
  });
  bot.hears('📋 Qabul tarixi', async ctx => {
    if (!await requireUser(ctx,true)) return;
    const ads=await db.lawyerHistory(ctx.from!.id);
    await ctx.reply(ads.length ? ads.map(adLine).join('\n').slice(0,3500) : 'Qabul tarixi bo‘sh.');
  });
  bot.callbackQuery(/^accept_req_(#[A-Z]{3}\d{3})$/, async ctx => {
    if (!await requireUser(ctx,true)) return;
    const code=ctx.match[1]!;
    const ad=await db.claimAd(code,ctx.from.id);
    if (!ad) return ctx.answerCallbackQuery({text:"Bu e'lon allaqachon qabul qilingan yoki topilmadi.",show_alert:true});
    await ctx.answerCallbackQuery({text:'Murojaat qabul qilindi.'});
    const lawyerLink = ctx.from.username ? `@${escapeHtml(ctx.from.username)}` : `<a href="tg://user?id=${ctx.from.id}">Huquqshunos</a>`;
    await ctx.api.sendMessage(ad.user_id, `Sizning ${escapeHtml(code)} raqamli murojaatingiz ${lawyerLink} tomonidan qabul qilindi. U tez orada siz bilan bog'lanadi.`, {parse_mode:'HTML'}).catch(()=>{console.error('Client notification failed');});
    await ctx.api.sendMessage(ctx.from.id, `Siz ${escapeHtml(code)} raqamli murojaatni qabul qildingiz!\n<a href="tg://user?id=${ad.user_id}">Mijoz bilan bog'lanish</a>`,{parse_mode:'HTML'}).catch(()=>{console.error('Lawyer notification failed');});
    await ctx.editMessageReplyMarkup({reply_markup:undefined}).catch(()=>{});
    await ctx.reply(`🔒 Murojaat ${lawyerLink} tomonidan qabul qilindi.`,{parse_mode:'HTML'}).catch(()=>{});
  });
  bot.hears('📄 Hujjat namunalari', async ctx => { if(await requireUser(ctx)) await ctx.reply('Hujjat turini tanlang:',{reply_markup:k.documentCategories()}); });
  bot.hears('📚 Huquqiy tushuntirishlar', async ctx => { if(await requireUser(ctx)) await showItems(ctx,'article'); });
  bot.hears('📖 Yuridik adabiyotlar', async ctx => { if(await requireUser(ctx,true)) await showItems(ctx,'lit'); });
  const showItems = async (ctx: BotContext,type:string) => {
    const items=await db.items(type);
    await ctx.reply(items.length?'Kerakli materialni tanlang:':'Hozircha materiallar mavjud emas.',items.length?{reply_markup:k.dynamicItems(items)}:{});
  };
  bot.callbackQuery(/^doc_(court|app|contract|other)$/,async ctx=>{
    if(!await requireUser(ctx)) return;
    await showItems(ctx,ctx.match[0]); await ctx.answerCallbackQuery();
  });
  bot.callbackQuery(/^get_item_(\d+)$/,async ctx=>{
    if(!await requireUser(ctx)) return;
    const item=await db.item(Number(ctx.match[1]));
    if(!item) return ctx.answerCallbackQuery({text:'Material topilmadi.',show_alert:true});
    if(/^https:\/\//.test(item.url_or_file_id)) await ctx.reply(item.url_or_file_id);
    else await ctx.replyWithDocument(item.url_or_file_id).catch(()=>ctx.reply('Faylni yuborib bo‘lmadi.'));
    await ctx.answerCallbackQuery();
  });
  bot.hears('🛠 Interaktiv xizmatlar',async ctx=>{if(await requireUser(ctx)) await ctx.reply('Xizmatni tanlang:',{reply_markup:k.interactiveServices()});});
  bot.callbackQuery(/^calc_(mortgage|alimony|penalty)$/,async ctx=>{
    if(!await requireUser(ctx)) return;
    await ctx.answerCallbackQuery({text:'Hisoblash formulasi tasdiqlanmagan; funksiya hozircha ishga tushirilmagan.',show_alert:true});
  });
  bot.hears('🌟 Top huquqshunoslar',async ctx=>{if(await requireUser(ctx)) await ctx.reply('Top huquqshunoslar ro‘yxati uchun mezonlar hali belgilanmagan.');});
  bot.hears('📑 Yuridik maqolalar (AI)',async ctx=>{if(await requireUser(ctx,true)) await ctx.reply('AI maqola yaratish talablari hali belgilanmagan.');});
  bot.callbackQuery(/^admin_(broadcast|add_doc|add_article|add_lit)$/,async ctx=>{
    if(!isAdmin(env,ctx.from.id)||!await requireUser(ctx)) return ctx.answerCallbackQuery({text:'Ruxsat yo‘q.',show_alert:true});
    const kind=ctx.match[1]!;
    if(kind==='broadcast') return ctx.answerCallbackQuery({text:'Ommaviy xabar tarqatish siyosati belgilanmagan.',show_alert:true});
    if(kind==='add_doc'){
      ctx.session.step='admin_category';
      await ctx.reply('Hujjat turini tanlang:',{reply_markup:k.adminDocumentCategories()});
      return ctx.answerCallbackQuery();
    }
    ctx.session.step=`admin_title_${kind.replace('add_','')}` as Step;
    ctx.session.draft={contentType:kind.replace('add_','')};
    await ctx.reply('Material nomini kiriting:'); await ctx.answerCallbackQuery();
  });
  bot.callbackQuery(/^admin_cat_(court|app|contract|other)$/,async ctx=>{
    if(!isAdmin(env,ctx.from.id)||!await requireUser(ctx)||ctx.session.step!=='admin_category')return ctx.answerCallbackQuery({text:'Ruxsat yo‘q.',show_alert:true});
    ctx.session.draft={contentType:`doc_${ctx.match[1]}`};
    ctx.session.step='admin_title_doc';
    await ctx.reply('Material nomini kiriting:');await ctx.answerCallbackQuery();
  });
  bot.on('message:text',async ctx=>{
    const u=await requireUser(ctx); if(!u) return;
    const text=ctx.message.text.trim(), s=ctx.session;
    if (s.step==='chatting') {
      if (!validText(text,2000)) return ctx.reply('Savol 1–2000 belgidan iborat bo‘lishi kerak.');
      await ctx.reply(await askYuristim(env,text,s.model)); return;
    }
    if (s.step==='category' || s.step==='description' || s.step==='bio' || s.step.startsWith('admin_title_') || s.step==='admin_value') {
      if(!validText(text,s.step==='description'?1500:300)) return ctx.reply('Matn uzunligi noto‘g‘ri. Qisqaroq yozing.');
      if(s.step==='category'){s.draft.category=text;s.step='description';return ctx.reply('Muammoingizni qisqacha tushuntirib bering:');}
      if(s.step==='description'){s.draft.description=text;s.step='price_type';return ctx.reply('Narxni qanday belgilaysiz?',{reply_markup:k.priceType()});}
      if(s.step==='bio'){if(u.role!=='lawyer') return;s.step='';await db.updateUser(ctx.from.id,{bio:text});return ctx.reply("Ma'lumotlaringiz saqlandi! Mijozlarni maxsus kanalimizdan topishingiz mumkin: @yuristim_channel");}
      if(s.step.startsWith('admin_title_')){if(!isAdmin(env,ctx.from.id))return;s.draft.title=text;s.step='admin_value';return ctx.reply('HTTPS havola yoki Telegram file_id kiriting:');}
      if(s.step==='admin_value'){if(!isAdmin(env,ctx.from.id))return;if(!/^https:\/\/\S+$/.test(text)&&!/^[\w-]{20,}$/.test(text))return ctx.reply('To‘g‘ri HTTPS havola yoki file_id kiriting.');await db.addItem(s.draft.contentType!,s.draft.title!,text);s.step='';s.draft={};return ctx.reply('Material saqlandi.');}
    }
    if(s.step==='min_price' || s.step==='max_price'){
      if(u.role!=='user')return;
      const value=price(text);if(value===null)return ctx.reply('Summani faqat musbat butun raqamda kiriting.');
      if(s.step==='min_price'){s.draft.min_price=value;s.step='max_price';return ctx.reply("Maksimal summani kiriting (so'mda):");}
      if(value<(s.draft.min_price??0))return ctx.reply('Maksimal summa minimal summadan kam bo‘lmasligi kerak.');
      s.draft.max_price=value;return finishAd(ctx);
    }
    await ctx.reply('Buyruqni menyudan tanlang yoki /start yuboring.');
  });
  bot.on('callback_query:data',async ctx=>{await ctx.answerCallbackQuery({text:'Bu tugma hozircha mavjud emas.',show_alert:true});});
  return bot;
}

export function updateActor(update: Update): number | null {
  return update.message?.from?.id ?? update.callback_query?.from.id ?? null;
}
