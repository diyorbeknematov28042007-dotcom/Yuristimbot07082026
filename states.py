from aiogram.fsm.state import State, StatesGroup

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
