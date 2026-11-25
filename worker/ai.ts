import type { Env } from './db';

export async function askYuristim(env: Env, prompt: string, model: 'gemini-2.5-flash' | 'gemini-2.5-pro'): Promise<string> {
  if (!env.GEMINI_API_KEY) return 'AI tizimi hozircha mavjud emas (API Kalit kiritilmagan).';
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Siz O'zbekiston Respublikasi qonunchiligi haqida umumiy ma'lumot beruvchi Yuristimsiz. Qonun moddasi yoki amaldagi tahririni tekshira olmasangiz, aniq manba deb ko'rsatmang; noaniqlikni ayting, mutaxassis va rasmiy manbaga yo'naltiring. Shaxsiy ma'lumotlarni qaytarmang." }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return 'AI xizmati vaqtincha javob bermayapti. Iltimos, keyinroq urinib ko‘ring.';
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim();
    return text ? `${text.slice(0, 3500)}\n\n⚠️ Javob umumiy ma’lumot. Qonunning amaldagi matnini rasmiy manbadan tekshiring yoki huquqshunosga murojaat qiling.` : 'AI javob bera olmadi. Iltimos, savolni boshqacha yozing.';
  } catch {
    return 'AI xizmati vaqtincha javob bermayapti. Iltimos, keyinroq urinib ko‘ring.';
  }
}
