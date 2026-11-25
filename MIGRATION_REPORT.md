# Yuristim Cloudflare migratsiyasi: holat va topshirish

2026-11-26 (Asia/Tashkent). Branch: `cloudflare-migration`; PR: https://github.com/diyorbeknematov28042007-dotcom/Yuristimbot07082026/pull/1. `main` o‘zgartirilmagan.

## Amalda bajarildi

- Python/Aiogram polling va RAM FSM o‘rniga Cloudflare Workers webhook, TypeScript/grammY va har bir Telegram foydalanuvchisi uchun SQLite Durable Object qo‘yildi. FSM, AI model tanlovi, update ID va flood hisoblagichi persist qilinadi.
- Supabase o‘rniga alohida staging va production D1 bazalari yaratildi. `users`, `requests`, `dynamic_content` jadvallari va indekslari qo‘yildi. Eski Supabase yozuvlari ko‘chirilmagan; eski loyiha o‘zgartirilmagan. D1 bazalar bo‘sh holatdan boshlandi.
- Webhook secret header, POST/JSON/body chegarasi, foydalanuvchi va admin huquqi tekshiruvlari, HTML escaping, parametrli SQL, timeout va xatolarni maxfiy matnsiz qayd etish joriy qilindi.
- Murojaatni qabul qilish bitta atomik `UPDATE ... WHERE status='active' RETURNING` bilan bajariladi. Telegram bir update’ni qayta yuborganda `source_update_id` unikal indeksi ikkinchi D1 murojaatni yaratmaydi.
- Staging Worker’ga test bot va Gemini kalitlari Cloudflare Secrets orqali o‘rnatildi. Test bot webhook’i staging’ga ulangan. Production Worker kodi va D1 mavjud; production bot tokeni va webhook secret’i qo‘yilmagan, production webhook almashtirilmagan.
- `wrangler.jsonc`, `.env.example`, `.gitignore`, GitHub Actions va README tayyorlangan. GitHub Actions branch/PR bo‘yicha tekshiruvdan muvaffaqiyatli o‘tadi.

## Sinovlar va chegarasi

| Tekshiruv | Natija |
| --- | --- |
| TypeScript strict typecheck, Wrangler build | O‘tdi; bundle ~214 KiB |
| Unit/handler/DO persistence/flood/idempotency testlari | 7/7 o‘tdi |
| Jonli D1 parallel lawyer claim | Ikkita urinishdan bittasi yutdi; test yozuvlari o‘chirildi |
| Jonli D1 takroriy source update | Bitta murojaat yozildi; test yozuvlari o‘chirildi |
| Staging health va webhook chegara testlari | 200; secret xato 401, media xato 415, JSON xato 400 |
| Telegram test bot webhook | `setWebhook` va `getWebhookInfo` o‘tdi; foydalanuvchi bot ishlayotganini tasdiqladi |
| Cloudflare observability issues | Staging va production uchun 0 faol issue (tekshirilgan paytda) |
| Production haqiqiy bot oqimi, kanal, admin | Hali tekshirilmagan: production tokeni, admin ID va kanal ID kerak |

`/health` D1, Gemini yoki Telegram integratsiyasini tekshirmaydi. Foydalanuvchining “ishlayapti” tasdig‘i barcha menyu oqimlari ham o‘tganini anglatmaydi. Telegramga yuborilgan tashqi xabar uzilish va retry oralig‘ida qayta yuborilishi mumkin; D1’da murojaat dublikati bartaraf etilgan, outbound exactly-once kafolati yo‘q.

## Free Plan hisob-kitobi

Workers Free: 100 000 request/kun, 10 ms CPU/request, 128 MB xotira. D1 Free: 5 mln row read/kun, 100 000 row write/kun, 500 MB/baza, 5 GB hisob bo‘yicha. Durable Objects Free: 100 000 request/kun va 100 000 row write/kun. Bir muvaffaqiyatli update odatda bir Worker va bir DO request, taxminan uch DO write hamda bir necha D1 read sarflaydi. Shuning uchun amaliy DO write chegarasi trafik shakliga qarab taxminan 30 000 muvaffaqiyatli update/kun atrofida bo‘lishi mumkin; bu kafolat emas. Monitoring orqali haqiqiy sarfni o‘lchash kerak.

Rasmiy manbalar: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/limits/ ; https://developers.cloudflare.com/durable-objects/platform/limits/ . Gemini API alohida limit/billingga ega. Google narx sahifasiga ko‘ra tanlangan Flash-Lite va Flash Preview modellari Free kvota ichida bepul, ammo Free tier’da yuborilgan kontent mahsulotni yaxshilash uchun ishlatilishi mumkin; bot AI menyusida maxfiy shaxsiy ma’lumotlarni yubormaslik ogohlantirishi bor. Paid Standard ochilsa Flash-Lite uchun taxminan $0.30 input / $2.50 output, Flash Preview uchun $0.50 input / $3.00 output (har 1 million token) bo‘ladi; thinking tokenlari ham output hisobiga kiradi. Haqiqiy xarajat trafik va Google loyihasining billing holatiga bog‘liq. Narx manbasi: https://ai.google.dev/gemini-api/docs/pricing . Pullik Cloudflare resursi yoqilmagan.

## Hali zarur bo‘lgan tashqi sozlash va ruxsat

1. Production bot tokenini va yangi webhook secret’ni **production Worker Secrets** ichida xavfsiz kiritish. Test bot tokenini production’ga qo‘ymang. `GEMINI_API_KEY` ham production loyihasiga tegishli bo‘lishi kerak.
2. Admin va kanal funksiyalarini ishga tushirish kerak bo‘lsa, `ADMIN_IDS`, `CHANNEL_ID` va kanalga botning yuborish ruxsatini sozlash; bu qiymatlar berilmagani sababli jonli sinov bajarilmadi.
3. GitHub Actions avtomatik staging deploy uchun GitHub repository secrets’da `CF_API_TOKEN`, `CF_ACCOUNT_ID` ni sozlash. Hozir CI testlari o‘tadi, ammo deploy qadami kalitlar bo‘lmagani uchun o‘tkazib yuboriladi. Cloudflare GitHub App orqali Workers Builds ulash ham mumkin, lekin dashboard sign-in va GitHub App authorization kerak. Hech bir deploy credential GitHub kodiga kiritilmaydi.
4. Production botning eski webhook URL/secret konfiguratsiyasini xavfsiz qayd etish, production end-to-end sinovini bajarish, **foydalanuvchining alohida tasdig‘idan keyingina** production webhook’ni o‘zgartirish. Eski hostingni ishlayotgan holda qoldirish.

## Rollback

Cutoverdan oldin `getWebhookInfo` orqali eski URL’ni saqlang. Xato bo‘lsa Telegram `setWebhook` bilan eski URL va uning original secret’ini qaytaring, `getWebhookInfo` va sinov update bilan tekshiring. Eski hostingni o‘chirmang. Worker versiyasini rollback qilish D1/DO ma’lumotlarini avtomatik orqaga qaytarmaydi; kerak bo‘lsa D1 Time Travel/export imkonlarini alohida tekshirib ishlating. Supabase’dagi tarixiy ma’lumotlar bu migratsiyada o‘zgartirilmagan.

Migratsiyadan tashqarida qolgan noaniq product funksiyalar: hujjat/ovoz AI tahlili, kalkulyator formulalari, top yuristlar reytingi, AI maqolalar va ommaviy xabar siyosati. Ular uchun biznes talabi aniqlanmaguncha yangi mantiq o‘ylab topilmagan.
