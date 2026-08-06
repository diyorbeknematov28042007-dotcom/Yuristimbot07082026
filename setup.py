import os

reqs = """aiogram==3.4.1
supabase==2.3.4
aiohttp==3.9.3
python-dotenv==1.0.1
google-genai==0.3.0
"""
with open("requirements.txt", "w") as f: f.write(reqs)

config_code = """import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL", "YOUR_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "YOUR_SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")

ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x]
CHANNEL_ID = os.getenv("CHANNEL_ID", "-100...") 

WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "https://your-app.onrender.com")
WEBHOOK_PATH = f"/webhook/{BOT_TOKEN}"
WEBHOOK_URL = f"{WEBHOOK_HOST}{WEBHOOK_PATH}"

WEBAPP_HOST = "0.0.0.0"
WEBAPP_PORT = int(os.getenv("PORT", 8080))
"""
with open("config.py", "w") as f: f.write(config_code)

database_code = """from supabase import create_client, Client
import config
import random
import string

try:
    supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
except Exception as e:
    supabase = None
    print(f"Supabase connection error: {e}")

def get_user(telegram_id: int):
    if not supabase: return None
    response = supabase.table("users").select("*").eq("telegram_id", telegram_id).execute()
    return response.data[0] if response.data else None

def create_user(telegram_id: int, full_name: str, username: str):
    if not supabase: return
    data = {
        "telegram_id": telegram_id,
        "full_name": full_name,
        "username": username,
        "role": "user",
        "is_accepted_offer": False
    }
    supabase.table("users").insert(data).execute()

def update_user_role(telegram_id: int, role: str):
    if not supabase: return
    supabase.table("users").update({"role": role}).eq("telegram_id", telegram_id).execute()

def accept_offer(telegram_id: int):
    if not supabase: return
    supabase.table("users").update({"is_accepted_offer": True}).eq("telegram_id", telegram_id).execute()

def update_lawyer_bio(telegram_id: int, bio: str):
    if not supabase: return
    supabase.table("users").update({"bio": bio}).eq("telegram_id", telegram_id).execute()

def generate_request_code():
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    numbers = "".join(random.choices(string.digits, k=3))
    return f"#{letters}{numbers}"

def create_request(user_id: int, category: str, description: str, price_type: str, min_price: int=None, max_price: int=None):
    if not supabase: return None
    code = generate_request_code()
    data = {
        "request_code": code,
        "user_id": user_id,
        "category": category,
        "description": description,
        "price_type": price_type,
        "min_price": min_price,
        "max_price": max_price,
        "status": "active"
    }
    supabase.table("requests").insert(data).execute()
    return code

def get_user_requests(user_id: int):
    if not supabase: return []
    response = supabase.table("requests").select("*").eq("user_id", user_id).execute()
    return response.data

def get_request(request_code: str):
    if not supabase: return None
    response = supabase.table("requests").select("*").eq("request_code", request_code).execute()
    return response.data[0] if response.data else None

def accept_request(request_code: str, lawyer_id: int):
    if not supabase: return None
    response = supabase.table("requests").update({
        "status": "accepted",
        "accepted_lawyer_id": lawyer_id
    }).eq("request_code", request_code).eq("status", "active").execute()
    return response.data[0] if response.data else None

def get_lawyer_history(lawyer_id: int):
    if not supabase: return []
    response = supabase.table("requests").select("*").eq("accepted_lawyer_id", lawyer_id).execute()
    return response.data

def add_dynamic_content(content_type: str, title: str, url_or_file_id: str):
    if not supabase: return
    supabase.table("dynamic_content").insert({
        "type": content_type,
        "title": title,
        "url_or_file_id": url_or_file_id
    }).execute()

def get_dynamic_content(content_type: str):
    if not supabase: return []
    response = supabase.table("dynamic_content").select("*").eq("type", content_type).execute()
    return response.data
"""
with open("database.py", "w") as f: f.write(database_code)

keyboards_code = """from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton

def role_selection_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👨‍⚖️ Huquqshunos", callback_data="role_lawyer")],
        [InlineKeyboardButton(text="👤 Foydalanuvchi", callback_data="role_user")]
    ])

def offer_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Ommaviy offerta 📄", url="https://telegra.ph/Ommaviy-Offerta-01-01")],
        [InlineKeyboardButton(text="✅ Qabul qilaman", callback_data="accept_offer")]
    ])

def user_main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🤖 Yuristim AI"), KeyboardButton(text="⚖️ Huquqshunos maslahati")],
            [KeyboardButton(text="🛠 Interaktiv xizmatlar"), KeyboardButton(text="📚 Huquqiy tushuntirishlar")],
            [KeyboardButton(text="📄 Hujjat namunalari")]
        ],
        resize_keyboard=True
    )

def lawyer_main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🤖 Yuristim AI"), KeyboardButton(text="🔍 Mijoz topish")],
            [KeyboardButton(text="📋 Qabul tarixi"), KeyboardButton(text="📚 Huquqiy tushuntirishlar")],
            [KeyboardButton(text="📄 Hujjat namunalari"), KeyboardButton(text="📖 Yuridik adabiyotlar")],
            [KeyboardButton(text="📑 Yuridik maqolalar (AI)")]
        ],
        resize_keyboard=True
    )

def ai_menu_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Modelni almashtirish", callback_data="ai_change_model")],
        [InlineKeyboardButton(text="📄 Hujjat tahlili", callback_data="ai_doc_analysis")],
        [InlineKeyboardButton(text="🎤 Ovozli xabar tahlili", callback_data="ai_voice_analysis")]
    ])

def back_reply_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="🔙 Orqaga")]],
        resize_keyboard=True
    )

def user_advice_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Yangi e\\'lon joylash", callback_data="new_ad")],
        [InlineKeyboardButton(text="📋 Mening e\\'lonlarim", callback_data="my_ads")]
    ])

def advice_reply_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🌟 Top huquqshunoslar")],
            [KeyboardButton(text="🔙 Orqaga")]
        ],
        resize_keyboard=True
    )

def price_type_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🤝 Kelishiladi", callback_data="price_agreed")],
        [InlineKeyboardButton(text="🆓 Bepul", callback_data="price_free")],
        [InlineKeyboardButton(text="💰 Aniq summa", callback_data="price_exact")]
    ])

def accept_request_keyboard(request_code: str):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Qabul qilish", callback_data=f"accept_req_{request_code}")]
    ])

def document_categories_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏛 Sud hujjatlari", callback_data="doc_court")],
        [InlineKeyboardButton(text="📝 Arizalar", callback_data="doc_app")],
        [InlineKeyboardButton(text="🤝 Shartnoma namunalari", callback_data="doc_contract")],
        [InlineKeyboardButton(text="📁 Boshqa hujjatlar", callback_data="doc_other")]
    ])

def interactive_services_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Ipoteka hisoblash", callback_data="calc_mortgage")],
        [InlineKeyboardButton(text="👶 Aliment hisoblash", callback_data="calc_alimony")],
        [InlineKeyboardButton(text="🚗 Jarima hisoblash", callback_data="calc_penalty")]
    ])
    
def admin_panel_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📢 Ommaviy xabar", callback_data="admin_broadcast")],
        [InlineKeyboardButton(text="➕ Hujjat qo\\'shish", callback_data="admin_add_doc")],
        [InlineKeyboardButton(text="➕ Tushuntirish qo\\'shish", callback_data="admin_add_article")],
        [InlineKeyboardButton(text="➕ Adabiyot qo\\'shish", callback_data="admin_add_lit")]
    ])

def dynamic_items_keyboard(items):
    buttons = []
    for item in items:
        url = item["url_or_file_id"] if item["url_or_file_id"].startswith("http") else None
        cdata = f"get_item_{item['id']}" if not url else "ignore"
        buttons.append([InlineKeyboardButton(text=item["title"], url=url, callback_data=cdata)])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
"""
with open("keyboards.py", "w") as f: f.write(keyboards_code)

states_code = """from aiogram.fsm.state import State, StatesGroup

class AdState(StatesGroup):
    category = State()
    description = State()
    price_type = State()
    min_price = State()
    max_price = State()

class LawyerState(StatesGroup):
    bio = State()

class AdminState(StatesGroup):
    broadcast_msg = State()
    content_type = State()
    content_title = State()
    content_file = State()

class AIState(StatesGroup):
    chatting = State()
    waiting_for_doc = State()
    waiting_for_voice = State()
"""
with open("states.py", "w") as f: f.write(states_code)

ai_code = """from google import genai
import config

try:
    client = genai.Client(api_key=config.GEMINI_API_KEY)
except Exception:
    client = None

async def ask_yuristim(prompt: str, model_type: str = "gemini-2.5-flash"):
    if not client: return "AI tizimi hozircha mavjud emas (API Kalit kiritilmagan)."
    try:
        response = client.models.generate_content(
            model=model_type,
            contents=f"Siz O\\'zbekiston Respublikasi qonunchiligiga asoslangan professional Yuristimsiz. Savol: {prompt}",
        )
        return response.text
    except Exception as e:
        return f"Xatolik yuz berdi: {str(e)}"
"""
with open("ai_service.py", "w") as f: f.write(ai_code)

main_code = """import logging
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
        "<b>Assalomu alaykum, Yuristim botiga xush kelibsiz!</b>\\n\\n"
        "Iltimos, botdan foydalanish uchun o\\'z rolingizni tanlang:"
    )
    await message.answer(welcome_text, reply_markup=keyboards.role_selection_keyboard())

@router.callback_query(F.data.startswith("role_"))
async def process_role_selection(callback: CallbackQuery):
    role = callback.data.split("_")[1]
    database.update_user_role(callback.from_user.id, role)
    
    await callback.message.edit_text(
        f"Siz <b>{'Huquqshunos' if role == 'lawyer' else 'Foydalanuvchi'}</b> rolini tanladingiz.\\n\\n"
        "Botdan foydalanish qoidalari bilan tanishib chiqing (Video darslik) va ommaviy offertani qabul qiling:",
        reply_markup=keyboards.offer_keyboard()
    )

@router.callback_query(F.data == "accept_offer")
async def process_accept_offer(callback: CallbackQuery):
    database.accept_offer(callback.from_user.id)
    await callback.message.delete()
    
    user = database.get_user(callback.from_user.id)
    kb = keyboards.lawyer_main_keyboard() if user["role"] == "lawyer" else keyboards.user_main_keyboard()
    await callback.message.answer("✅ Offerta qabul qilindi! Botdan to\\'liq foydalanishingiz mumkin.", reply_markup=kb)

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
        "🤖 <b>Yuristim AI</b>\\n\\n"
        "Joriy model: Yuristim 1.0 (Tezkor)\\n"
        "Savolingizni to\\'g\\'ridan-to\\'g\\'ri yozib yuboring yoki quyidagi imkoniyatlardan foydalaning:"
    )
    await message.answer(text, reply_markup=keyboards.ai_menu_keyboard())

@router.callback_query(F.data == "ai_change_model")
async def ai_change_model(callback: CallbackQuery):
    current = user_models.get(callback.from_user.id, "gemini-2.5-flash")
    new_model = "gemini-2.5-pro" if current == "gemini-2.5-flash" else "gemini-2.5-flash"
    user_models[callback.from_user.id] = new_model
    name = "1.5 (Chuqur o\\'y)" if new_model == "gemini-2.5-pro" else "1.0 (Tezkor)"
    await callback.answer(f"Model {name} ga o\\'zgartirildi!", show_alert=True)
    await callback.message.edit_text(f"🤖 <b>Yuristim AI</b>\\n\\nJoriy model: Yuristim {name}\\nSavolingizni yo\\'llang:", reply_markup=keyboards.ai_menu_keyboard())

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
    await message.answer("Huquqshunos maslahati bo\\'limi:", reply_markup=keyboards.advice_reply_keyboard())
    await message.answer("O\\'zingizga kerakli bo\\'limni tanlang:", reply_markup=keyboards.user_advice_keyboard())

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
        await callback.message.answer("Minimal summani kiriting (so\\'mda):")
    else:
        await finish_ad_creation(callback.message, state, callback.from_user.id)
        await callback.message.delete()

@router.message(AdState.min_price)
async def ad_min_price(message: Message, state: FSMContext):
    await state.update_data(min_price=message.text)
    await state.set_state(AdState.max_price)
    await message.answer("Maksimal summani kiriting (so\\'mda):")

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
    
    price_text = "#kelishiladi" if data["price_type"] == "agreed" else "#bepul" if data["price_type"] == "free" else f"{data.get('min_price')} - {data.get('max_price')} so\\'m"
    ad_text = (
        f"<b>Yangi e\\'lon: {code}</b>\\n\\n"
        f"<b>Maqsad:</b> #{data['category'].replace(' ', '_')}\\n"
        f"<b>Tavsif:</b> {data['description']}\\n"
        f"<b>Narx:</b> {price_text}\\n"
    )
    
    await message.answer(f"E\\'loningiz qabul qilindi! ID: {code}\\nKanalimizni kuzatib boring: @yuristim_channel")
    
    if config.CHANNEL_ID and config.CHANNEL_ID != "YOUR_CHANNEL_ID":
        try:
            await bot.send_message(config.CHANNEL_ID, ad_text, reply_markup=keyboards.accept_request_keyboard(code))
        except Exception as e:
            logging.error(f"Kanalga yuborishda xatolik: {e}")

# --- LAWYER: MIJOZ TOPISH ---
@router.message(F.text == "🔍 Mijoz topish")
async def lawyer_find_clients(message: Message, state: FSMContext):
    await state.set_state(LawyerState.bio)
    await message.answer("O\\'zingiz haqida qisqacha ma\\'lumot qoldiring (Tajriba, sohalaringiz):")

@router.message(LawyerState.bio)
async def lawyer_bio_saved(message: Message, state: FSMContext):
    database.update_lawyer_bio(message.from_user.id, message.text)
    await state.clear()
    await message.answer("Ma\\'lumotlaringiz saqlandi! Mijozlarni maxsus kanalimizdan topishingiz mumkin: @yuristim_channel")

# --- KANALDAN QABUL QILISH ---
@router.callback_query(F.data.startswith("accept_req_"))
async def accept_client_request(callback: CallbackQuery):
    code = callback.data.split("_")[2]
    req = database.get_request(code)
    if not req:
        await callback.answer("E\\'lon topilmadi yoki o\\'chirilgan.", show_alert=True)
        return
    if req["status"] != "active":
        await callback.answer("Bu e\\'lon allaqachon qabul qilingan.", show_alert=True)
        return
    
    lawyer_id = callback.from_user.id
    lawyer = database.get_user(lawyer_id)
    if not lawyer or lawyer["role"] != "lawyer":
        await callback.answer("Siz huquqshunos emassiz!", show_alert=True)
        return
        
    database.accept_request(code, lawyer_id)
    
    client_id = req["user_id"]
    lawyer_link = f"@{callback.from_user.username}" if callback.from_user.username else f"<a href='tg://user?id={lawyer_id}'>Huquqshunos</a>"
    client_msg = f"Sizning {code} raqamli murojaatingiz {lawyer_link} tomonidan qabul qilindi. U tez orada siz bilan bog\\'lanadi."
    try:
        await bot.send_message(client_id, client_msg)
    except:
        pass
        
    client_link = f"<a href='tg://user?id={client_id}'>Mijoz bilan bog\\'lanish</a>"
    await bot.send_message(lawyer_id, f"Siz {code} raqamli murojaatni qabul qildingiz!\\n{client_link}")
    
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
"""
with open("main.py", "w") as f: f.write(main_code)

schema_code = """-- Supabase SQL
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT,
    role TEXT DEFAULT 'user',
    bio TEXT,
    is_accepted_offer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    request_code TEXT UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(telegram_id),
    category TEXT,
    description TEXT,
    price_type TEXT,
    min_price NUMERIC,
    max_price NUMERIC,
    status TEXT DEFAULT 'active',
    accepted_lawyer_id BIGINT REFERENCES users(telegram_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dynamic_content (
    id SERIAL PRIMARY KEY,
    type TEXT,
    title TEXT,
    url_or_file_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
"""
with open("supabase_schema.sql", "w") as f: f.write(schema_code)
