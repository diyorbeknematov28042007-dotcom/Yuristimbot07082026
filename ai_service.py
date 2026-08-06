from google import genai
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
            contents=f"Siz O\'zbekiston Respublikasi qonunchiligiga asoslangan professional Yuristimsiz. Savol: {prompt}",
        )
        return response.text
    except Exception as e:
        return f"Xatolik yuz berdi: {str(e)}"
