from supabase import create_client, Client
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
