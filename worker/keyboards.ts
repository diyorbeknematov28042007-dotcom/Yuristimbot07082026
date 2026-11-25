import { InlineKeyboard, Keyboard } from 'grammy';
import type { Item } from './db';

export const roleSelection = () => new InlineKeyboard().text('👨‍⚖️ Huquqshunos', 'role_lawyer').row().text('👤 Foydalanuvchi', 'role_user');
export const offer = () => new InlineKeyboard().url('Ommaviy offerta 📄', 'https://telegra.ph/Ommaviy-Offerta-01-01').row().text('✅ Qabul qilaman', 'accept_offer');
export const userMain = () => new Keyboard().text('🤖 Yuristim AI').text('⚖️ Huquqshunos maslahati').row().text('🛠 Interaktiv xizmatlar').text('📚 Huquqiy tushuntirishlar').row().text('📄 Hujjat namunalari').resized();
export const lawyerMain = () => new Keyboard().text('🤖 Yuristim AI').text('🔍 Mijoz topish').row().text('📋 Qabul tarixi').text('📚 Huquqiy tushuntirishlar').row().text('📄 Hujjat namunalari').text('📖 Yuridik adabiyotlar').row().text('📑 Yuridik maqolalar (AI)').resized();
export const back = () => new Keyboard().text('🔙 Orqaga').resized();
export const aiMenu = () => new InlineKeyboard().text('🔄 Modelni almashtirish', 'ai_change_model').row().text('📄 Hujjat tahlili', 'ai_doc_analysis').row().text('🎤 Ovozli xabar tahlili', 'ai_voice_analysis');
export const advice = () => new InlineKeyboard().text("📝 Yangi e'lon joylash", 'new_ad').row().text("📋 Mening e'lonlarim", 'my_ads');
export const adviceReply = () => new Keyboard().text('🌟 Top huquqshunoslar').row().text('🔙 Orqaga').resized();
export const priceType = () => new InlineKeyboard().text('🤝 Kelishiladi', 'price_agreed').row().text('🆓 Bepul', 'price_free').row().text('💰 Aniq summa', 'price_exact');
export const acceptRequest = (code: string) => new InlineKeyboard().text('✅ Qabul qilish', `accept_req_${code}`);
export const documentCategories = () => new InlineKeyboard().text('🏛 Sud hujjatlari', 'doc_court').row().text('📝 Arizalar', 'doc_app').row().text('🤝 Shartnoma namunalari', 'doc_contract').row().text('📁 Boshqa hujjatlar', 'doc_other');
export const adminDocumentCategories = () => new InlineKeyboard().text('🏛 Sud hujjatlari', 'admin_cat_court').row().text('📝 Arizalar', 'admin_cat_app').row().text('🤝 Shartnoma namunalari', 'admin_cat_contract').row().text('📁 Boshqa hujjatlar', 'admin_cat_other');
export const interactiveServices = () => new InlineKeyboard().text('🏠 Ipoteka hisoblash', 'calc_mortgage').row().text('👶 Aliment hisoblash', 'calc_alimony').row().text('🚗 Jarima hisoblash', 'calc_penalty');
export const adminPanel = () => new InlineKeyboard().text('📢 Ommaviy xabar', 'admin_broadcast').row().text("➕ Hujjat qo'shish", 'admin_add_doc').row().text("➕ Tushuntirish qo'shish", 'admin_add_article').row().text("➕ Adabiyot qo'shish", 'admin_add_lit');
export const dynamicItems = (items: Item[]) => {
  const k = new InlineKeyboard();
  for (const item of items) {
    if (/^https:\/\//.test(item.url_or_file_id)) k.url(item.title.slice(0,60), item.url_or_file_id).row();
    else k.text(item.title.slice(0,60), `get_item_${item.id}`).row();
  }
  return k;
};
