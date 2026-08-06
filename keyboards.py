from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton

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
        [InlineKeyboardButton(text="📝 Yangi e\'lon joylash", callback_data="new_ad")],
        [InlineKeyboardButton(text="📋 Mening e\'lonlarim", callback_data="my_ads")]
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
        [InlineKeyboardButton(text="➕ Hujjat qo\'shish", callback_data="admin_add_doc")],
        [InlineKeyboardButton(text="➕ Tushuntirish qo\'shish", callback_data="admin_add_article")],
        [InlineKeyboardButton(text="➕ Adabiyot qo\'shish", callback_data="admin_add_lit")]
    ])

def dynamic_items_keyboard(items):
    buttons = []
    for item in items:
        url = item["url_or_file_id"] if item["url_or_file_id"].startswith("http") else None
        cdata = f"get_item_{item['id']}" if not url else "ignore"
        buttons.append([InlineKeyboardButton(text=item["title"], url=url, callback_data=cdata)])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
