import logging
import sys
import asyncio
from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.context import FSMContext

import config
import database
import keyboards
import ai_service
from states import AdState, LawyerState, AdminState, AIState

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
router = Router()
dp.include_router(router)

user_models = {}

def get_main_kb(user_id):
    user = database.get_user(user_id)
    if not user: return keyboards.user_main_keyboard()
    if user["role"] == "lawyer": return keyboards.lawyer_main_keyboard()
    return keyboards.user_main_keyboard()

# --- START & REGISTRATION ---
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    user = database.get_user(message.from_user.id)
    if not user:
        database.create_user(message.from_user.id, message.from_user.full_name, message.from_user.username)
        
    welcome_text = (
        "<b>Assalomu alaykum, Yuristim botiga xush kelibsiz!</b>\n\n"
        "Iltimos, botdan foydalanish uchun o\'z rolingizni tanlang:"
    )
    await message.answer(welcome_text, reply_markup=keyboards.role_selection_keyboard())

@router.callback_query(F.data.startswith("role_"))
async def process_role_selection(callback: CallbackQuery):
    role = callback.data.split("_")[1]
    database.update_user_role(callback.from_user.id, role)
    
    await callback.message.edit_text(
        f"Siz <b>{'Huquqshunos' if role == 'lawyer' else 'Foydalanuvchi'}</b> rolini tanladingiz.\n\n"
        "Botdan foydalanish qoidalari bilan tanishib chiqing (Video darslik) va ommaviy offertani qabul qiling:",
        reply_markup=keyboards.offer_keyboard()
    )

@router.callback_query(F.data == "accept_offer")
async def process_accept_offer(callback: CallbackQuery):
    database.accept_offer(callback.from_user.id)
    await callback.message.delete()
    
    user = database.get_user(callback.from_user.id)
    kb = keyboards.lawyer_main_keyboard() if user["role"] == "lawyer" else keyboards.user_main_keyboard()
    await callback.message.answer("✅ Offerta qabul qilindi! Botdan to\'liq foydalanishingiz mumkin.", reply_markup=kb)

# --- BACK BUTTON ---
@router.message(F.text == "🔙 Orqaga")
async def back_to_main(message: Message, state: FSMContext):
    await state.clear()
    await message.answer("Bosh sahifa", reply_markup=get_main_kb(message.from_user.id))

# --- YURISTIM AI ---
@router.message(F.text == "🤖 Yuristim AI")
async def open_ai_menu(message: Message, state: FSMContext):
    await state.set_state(AIState.chatting)
    user_models[message.from_user.id] = "gemini-2.5-flash"
    text = (
        "🤖 <b>Yuristim AI</b>\n\n"
        "Joriy model: Yuristim 1.0 (Tezkor)\n"
        "Savolingizni to\'g\'ridan-to\'g\'ri yozib yuboring yoki quyidagi imkoniyatlardan foydalaning:"
    )
    await message.answer(text, reply_markup=keyboards.ai_menu_keyboard())

@router.callback_query(F.data == "ai_change_model")
async def ai_change_model(callback: CallbackQuery):
    current = user_models.get(callback.from_user.id, "gemini-2.5-flash")
    new_model = "gemini-2.5-pro" if current == "gemini-2.5-flash" else "gemini-2.5-flash"
    user_models[callback.from_user.id] = new_model
    name = "1.5 (Chuqur o\'y)" if new_model == "gemini-2.5-pro" else "1.0 (Tezkor)"
    await callback.answer(f"Model {name} ga o\'zgartirildi!", show_alert=True)
    await callback.message.edit_text(f"🤖 <b>Yuristim AI</b>\n\nJoriy model: Yuristim {name}\nSavolingizni yo\'llang:", reply_markup=keyboards.ai_menu_keyboard())

@router.message(AIState.chatting, F.text & ~F.text.startswith("/"))
async def process_ai_question(message: Message):
    if message.text in ["🔙 Orqaga", "🤖 Yuristim AI", "⚖️ Huquqshunos maslahati", "🛠 Interaktiv xizmatlar"]:
        return
    
    wait_msg = await message.answer("⌛️") 
    model = user_models.get(message.from_user.id, "gemini-2.5-flash")
    response = await ai_service.ask_yuristim(message.text, model)
    await wait_msg.delete()
    await message.answer(response)

# --- USER: HUQUQSHUNOS MASLAHATI ---
@router.message(F.text == "⚖️ Huquqshunos maslahati")
async def user_advice_menu(message: Message):
    await message.answer("Huquqshunos maslahati bo\'limi:", reply_markup=keyboards.advice_reply_keyboard())
    await message.answer("O\'zingizga kerakli bo\'limni tanlang:", reply_markup=keyboards.user_advice_keyboard())

@router.callback_query(F.data == "new_ad")
async def new_ad_start(callback: CallbackQuery, state: FSMContext):
    await state.set_state(AdState.category)
    await callback.message.answer("Murojaat maqsadi nima? (Masalan: Advokat xizmati, Yuridik maslahat, Hujjat tayyorlash)")

@router.message(AdState.category)
async def ad_category(message: Message, state: FSMContext):
    await state.update_data(category=message.text)
    await state.set_state(AdState.description)
    await message.answer("Muammoingizni qisqacha tushuntirib bering:")

@router.message(AdState.description)
async def ad_desc(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    await state.set_state(AdState.price_type)
    await message.answer("Narxni qanday belgilaysiz?", reply_markup=keyboards.price_type_keyboard())

@router.callback_query(AdState.price_type, F.data.startswith("price_"))
async def ad_price_type(callback: CallbackQuery, state: FSMContext):
    ptype = callback.data.split("_")[1]
    await state.update_data(price_type=ptype)
    
    if ptype == "exact":
        await state.set_state(AdState.min_price)
        await callback.message.answer("Minimal summani kiriting (so\'mda):")
    else:
        await finish_ad_creation(callback.message, state, callback.from_user.id)
        await callback.message.delete()

@router.message(AdState.min_price)
async def ad_min_price(message: Message, state: FSMContext):
    await state.update_data(min_price=message.text)
    await state.set_state(AdState.max_price)
    await message.answer("Maksimal summani kiriting (so\'mda):")

@router.message(AdState.max_price)
async def ad_max_price(message: Message, state: FSMContext):
    await state.update_data(max_price=message.text)
    await finish_ad_creation(message, state, message.from_user.id)

async def finish_ad_creation(message: Message, state: FSMContext, user_id: int):
    data = await state.get_data()
    code = database.create_request(
        user_id, data["category"], data["description"], 
        data["price_type"], data.get("min_price"), data.get("max_price")
    )
    await state.clear()
    
    price_text = "#kelishiladi" if data["price_type"] == "agreed" else "#bepul" if data["price_type"] == "free" else f"{data.get('min_price')} - {data.get('max_price')} so\'m"
    ad_text = (
        f"<b>Yangi e\'lon: {code}</b>\n\n"
        f"<b>Maqsad:</b> #{data['category'].replace(' ', '_')}\n"
        f"<b>Tavsif:</b> {data['description']}\n"
        f"<b>Narx:</b> {price_text}\n"
    )
    
    await message.answer(f"E\'loningiz qabul qilindi! ID: {code}\nKanalimizni kuzatib boring: @yuristim_channel")
    
    if config.CHANNEL_ID and config.CHANNEL_ID != "YOUR_CHANNEL_ID":
        try:
            await bot.send_message(config.CHANNEL_ID, ad_text, reply_markup=keyboards.accept_request_keyboard(code))
        except Exception as e:
            logging.error(f"Kanalga yuborishda xatolik: {e}")

# --- LAWYER: MIJOZ TOPISH ---
@router.message(F.text == "🔍 Mijoz topish")
async def lawyer_find_clients(message: Message, state: FSMContext):
    await state.set_state(LawyerState.bio)
    await message.answer("O\'zingiz haqida qisqacha ma\'lumot qoldiring (Tajriba, sohalaringiz):")

@router.message(LawyerState.bio)
async def lawyer_bio_saved(message: Message, state: FSMContext):
    database.update_lawyer_bio(message.from_user.id, message.text)
    await state.clear()
    await message.answer("Ma\'lumotlaringiz saqlandi! Mijozlarni maxsus kanalimizdan topishingiz mumkin: @yuristim_channel")

# --- KANALDAN QABUL QILISH ---
@router.callback_query(F.data.startswith("accept_req_"))
async def accept_client_request(callback: CallbackQuery):
    code = callback.data.split("_")[2]
    req = database.get_request(code)
    if not req:
        await callback.answer("E\'lon topilmadi yoki o\'chirilgan.", show_alert=True)
        return
    if req["status"] != "active":
        await callback.answer("Bu e\'lon allaqachon qabul qilingan.", show_alert=True)
        return
    
    lawyer_id = callback.from_user.id
    lawyer = database.get_user(lawyer_id)
    if not lawyer or lawyer["role"] != "lawyer":
        await callback.answer("Siz huquqshunos emassiz!", show_alert=True)
        return
        
    database.accept_request(code, lawyer_id)
    
    client_id = req["user_id"]
    lawyer_link = f"@{callback.from_user.username}" if callback.from_user.username else f"<a href='tg://user?id={lawyer_id}'>Huquqshunos</a>"
    client_msg = f"Sizning {code} raqamli murojaatingiz {lawyer_link} tomonidan qabul qilindi. U tez orada siz bilan bog\'lanadi."
    try:
        await bot.send_message(client_id, client_msg)
    except:
        pass
        
    client_link = f"<a href='tg://user?id={client_id}'>Mijoz bilan bog\'lanish</a>"
    await bot.send_message(lawyer_id, f"Siz {code} raqamli murojaatni qabul qildingiz!\n{client_link}")
    
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply(f"🔒 Murojaat {lawyer_link} tomonidan qabul qilindi.")

# --- ADMIN PANEL ---
@router.message(Command("admin"))
async def admin_panel(message: Message):
    if message.from_user.id not in config.ADMIN_IDS: return
    await message.answer("Admin panelga xush kelibsiz!", reply_markup=keyboards.admin_panel_keyboard())

# --- WEBHOOK ---
async def on_startup(bot: Bot):
    if config.WEBHOOK_URL.startswith("http") and "your-app" not in config.WEBHOOK_URL:
        try:
            await bot.set_webhook(config.WEBHOOK_URL)
            logging.info(f"Webhook set to {config.WEBHOOK_URL}")
        except Exception as e:
            logging.error(f"Failed to set webhook: {e}")

def main():
    dp.startup.register(on_startup)
    app = web.Application()
    webhook_requests_handler = SimpleRequestHandler(dispatcher=dp, bot=bot)
    webhook_requests_handler.register(app, path=config.WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)
    web.run_app(app, host=config.WEBAPP_HOST, port=config.WEBAPP_PORT)

if __name__ == "__main__":
    if config.BOT_TOKEN != "YOUR_BOT_TOKEN":
        main()
    else:
        print("Iltimos, config.py ichida BOT_TOKEN ni kiriting!")
