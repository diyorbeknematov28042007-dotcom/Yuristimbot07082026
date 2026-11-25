# Yuristim Telegram bot — Cloudflare migration

## Architecture

Telegram `/webhook` → Worker (`worker/index.ts`: POST secret header, body limit) → per Telegram user SQLite Durable Object (`worker/state.ts`: persistent session, dedupe, 8 updates/10s, serialized handler execution) → grammY (`worker/bot.ts`) → existing Supabase REST tables (`worker/db.ts`) and Gemini HTTP (`worker/ai.ts`). GET `/health` is a public liveness check without private data. The original Python implementation remains on `main` and can remain on its current hosting while staging is tested. No database records are deleted or copied.

Each user's Durable Object stores a session and recent Telegram update IDs. Session is saved after successful handling. The Supabase `requests` claim is an atomic `PATCH ... status=eq.active`, so competing lawyers cannot both win. As with most webhook systems, a crash between an external Telegram send and the session write can cause that send to repeat on a retry. Inspect before production cutover if strict exactly-once outbound delivery is required. Traffic is not automatically migrated by a Worker deployment.
Abandoned draft descriptions are cleared by a Durable Object alarm after 24 hours since the last processed draft update. Accepted requests remain in Supabase according to the existing retention policy.

## Audit and migration notes

- Existing `main.py` uses Aiogram's default in-memory FSM; `user_models` is a global dict; sync `supabase` and `genai` calls block the event loop.
- `config.py` puts the bot token into the webhook URL and logs that URL; no Telegram secret header is checked. The new endpoint uses `/webhook` and `WEBHOOK_SECRET`.
- Existing lawyer accept code ignores the result of its conditional update and then sends both success messages. The new handler uses the returned row only.
- Existing `keyboards.py` exposes callbacks `my_ads`, `doc_*`, `get_item_*`, `calc_*`, admin callbacks and some reply buttons with no handlers. Implemented: own ads, lawyer history, document categories, dynamic content listing/file delivery, admin content addition. Incomplete product requirements: document and voice AI analysis, legal article generation, calculators, top lawyer ranking, bulk broadcast. They now return an explicit unavailable explanation and require product definitions before implementation.
- Self-selected lawyer role is preserved. It is **not** proof of professional certification. Do not market it as identity verification.
- Existing schema has no RLS policies. A service-role key must remain server-side; review real production policies/grants in Supabase before cutover. This repository alone cannot prove the live RLS configuration.
- Admin document uploads now select the same `doc_court`, `doc_app`, `doc_contract`, or `doc_other` category that the user document menu queries. AI questions are sent to Gemini and should be covered by the public offer/privacy notice.
- `setup.py` is a generator that duplicates old Python source; `src/` and Vite files are an unrelated empty UI scaffold, unused by the Worker. Kept for review and easy rollback.

## Setup and staging

1. `npm ci && npm run typecheck && npm test && npm run build`. Wrangler targets the staging environment for build. Avoid running local tests with production Supabase credentials.
2. Confirm Cloudflare Workers Free and Durable Objects Free quotas. Staging and production are **different** Worker names and Durable Object namespaces. Staging should have a separate Supabase test project and a separate Telegram test bot; never set staging to the production bot token or production database.
3. Generate a random Telegram secret using a password manager or `openssl rand -hex 32`. Store `BOT_TOKEN`, `WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, `ADMIN_IDS`, `CHANNEL_ID` as **Secrets** for each Worker through Cloudflare dashboard → Workers & Pages → Worker → Settings → Variables and Secrets (or `npx wrangler secret put NAME --env staging`). Enter secret values directly into Cloudflare, not chat, GitHub, committed files, logs or command-line flags. `SUPABASE_URL`, `ADMIN_IDS` and `CHANNEL_ID` can be ordinary nonsecret variables, but secrets are convenient. In CI use repository `CF_API_TOKEN` (Workers Scripts Write + Durable Objects Write) and `CF_ACCOUNT_ID` as GitHub Actions secrets. These are deploy credentials, not Worker runtime secrets.
4. `npm run deploy:staging`, then `curl https://yuristim-bot-staging.<your-subdomain>.workers.dev/health`. A test bot can use `setWebhook` with `secret_token` equal to staging `WEBHOOK_SECRET` and URL ending `/webhook`. This changes **only** the test bot. Test registration, ads, claim race, AI, admin, error handling and view metrics. Never set the production bot webhook during staging.
5. For production, provision the same secrets on `yuristim-bot`, review Supabase security and traffic, deploy from approved main using the protected `production` GitHub environment/manual workflow or `npm run deploy:production`. Only after explicit approval set the production bot webhook to `https://yuristim-bot.<subdomain>.workers.dev/webhook` with `secret_token` via Telegram API. Keep the old hosting running through the observation window.

`/health` checks the Worker only. It cannot prove Telegram, Gemini, Supabase, or secrets are configured. Worker logs record error categories only, never legal text, API bodies or secret values. AI answers carry a legal verification caveat.

## Database and RLS

Production tables remain `users`, `requests`, `dynamic_content` from `supabase_schema.sql`. The old primary and foreign keys are preserved. REST writes use the Supabase service-role key only in the Worker; do not expose it to the frontend. Test live key privileges and RLS in Supabase Dashboard/SQL Editor. Do not disable RLS blindly: review other clients and policy ownership. Prefer RLS enabled, revoke anonymous direct access where feasible and keep privileged key exclusively server-side. The new Worker uses no schema migration.

## Limits and costs

Workers Free: 100,000 requests/day, 10 ms CPU/request, 128 MB/isolate, 50 external subrequests/invocation. Durable Objects Free: 100,000 requests/day, 13,000 GB-s/day, 5 million rows read/day, 100,000 rows written/day and 5 GB storage. Typical update: one Worker request, one Durable Object request, approximately three Durable Object row writes (rate, dedupe, session), a few state reads and 1–4 Supabase/Telegram fetches; AI adds one Gemini request. Thus the 100,000 daily DO row-write quota may constrain this design to roughly 30,000 successful updates/day before cleanup writes, well before the Worker request quota. Actual CPU, duration, row usage and external prices need measured traffic. Supabase and Gemini quotas/billing are separate. Gemini's published pricing warns that both `gemini-2.5-flash` and `gemini-2.5-pro` will be routed to successor models from December 1, 2026; review compatibility and pricing before that date.

## Rollback

Before cutover capture the old webhook address and `getWebhookInfo` result securely. To roll back, call Telegram `setWebhook` for the previous URL using the old bot's configuration and secret, then verify `getWebhookInfo` and send a test update. Keep old hosting online until rollback is tested. Existing Supabase records remain in place; avoid two active webhook handlers for one bot. Reverting code or Cloudflare deployments does not roll back database or Durable Object state.
