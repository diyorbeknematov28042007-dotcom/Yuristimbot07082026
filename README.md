# Yuristim bot on Cloudflare Workers and D1

## Architecture

Telegram `/webhook` → Cloudflare Worker (`worker/index.ts`) → per-user SQLite Durable Object (`worker/state.ts`) → grammY handlers (`worker/bot.ts`) → Cloudflare D1 (`worker/db.ts`) and Gemini HTTP (`worker/ai.ts`).

D1 stores users, requests and dynamic content. Durable Objects store the conversation step, selected AI model, recent update IDs and flood counters. No Supabase connection is used by the Worker. Staging and production have different D1 databases and Durable Object namespaces. The original Python branch and Supabase project remain untouched, but no historical users or requests are imported: the D1 databases intentionally start empty.

The webhook requires Telegram's `X-Telegram-Bot-Api-Secret-Token` header. Only named runtime secrets are read; no token appears in the URL. Access checks run in bot handlers. A single `UPDATE ... WHERE status='active' RETURNING` in D1 allows only one lawyer to accept a request. A unique source update ID keeps a retried Telegram update from creating a second request. An abandoned draft is cleared from Durable Object storage after 24 hours. External Telegram sends can still repeat if a Worker fails after sending but before recording successful processing; strict exactly-once outbound delivery is not guaranteed.

## Existing-code audit

- The Aiogram bot used an in-memory FSM and global AI model map, synchronous Supabase and Gemini calls, a token-bearing webhook URL, and no webhook header authentication.
- The original accept handler ignored the result of a conditional database update, potentially notifying multiple lawyers.
- Implemented formerly missing handlers for own ads, lawyer history, document categories, dynamic content, and admin content uploads. Other visible buttons (document/voice AI analysis, calculators, top lawyer ranking, AI legal article generation, bulk broadcast) have no defined product behavior in the original source; they return a clear unavailable notice.
- Lawyer role is self-selected, not professional identity verification.
- The original `setup.py` duplicates legacy Python files. The `src/` Vite scaffold is unrelated to the Worker and is retained for review.

## Setup

Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` before deploying. Wrangler config includes staging `yuristim-bot-staging` and production `yuristim-bot`. Both D1 databases have been created and initialized with [d1-schema.sql](d1-schema.sql) and the one-time [idempotency migration](d1-migrations/0002_request_idempotency.sql). To create a new environment, run `npx wrangler d1 execute DB --env staging --remote --file d1-schema.sql` (the migration is only for existing databases created before this change). Verify the target binding before using `--env production`. Never run production writes on a test database.

Staging runtime secrets: `BOT_TOKEN` (a separate test bot), `WEBHOOK_SECRET` (random Telegram webhook secret), `GEMINI_API_KEY`. Optional `ADMIN_IDS` and `CHANNEL_ID` allow testing admin and channel flows. Set each in Cloudflare dashboard → Workers & Pages → Worker → Settings → Variables and Secrets, or use `npx wrangler secret put NAME --env staging` interactively. Do not put values in a repository, issue, command argument, or log. No Supabase key is required. In GitHub Actions, add `CF_API_TOKEN` with Workers/D1/DO write permissions and `CF_ACCOUNT_ID` as repository secrets to enable branch staging deployment; CI verification runs without them.

Deploy with `npm run deploy:staging`, verify `/health`, then set **only the test bot** webhook to `https://yuristim-bot-staging.<subdomain>.workers.dev/webhook` with its matching `secret_token`. Test registration, offer, both roles, AI, ad creation, channel post, lawyer claim, admin and D1 state. Production webhook is a separate cutover requiring explicit approval; keep the previous hosting online until the new path is verified.

A `GET /health` response only proves that the Worker runs. It does not verify Telegram, Gemini, D1 bindings, channel permissions, or runtime secrets. Logs record error categories rather than personal legal text.

## Free Plan and external services

Workers Free: 100,000 requests/day, 10 ms CPU/request, 128 MB/isolate and 50 external subrequests/invocation. D1 Free: 5 million rows read/day, 100,000 rows written/day, 10 databases, 500 MB/database and 5 GB total storage. SQLite Durable Objects Free: 100,000 requests/day, 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Typically one bot update uses one Worker and Durable Object request, around three Durable Object row writes, and several indexed D1 reads. The Durable Object write quota may constrain this design to about 30,000 successful updates/day even when D1 is below its own limits. Actual CPU and database row metrics must be measured in Cloudflare. The Gemini API has independent rate limits and billing. The original Gemini 2.5 model IDs returned 404 with the test key; the current Fast/Deep menu maps to `gemini-3.5-flash-lite` and `gemini-3-flash-preview`, both tested with real generation requests. The preview model requires availability and cost monitoring.

## Rollback

Record the old webhook URL before cutover. To roll back, set Telegram's production webhook to the old URL and its original secret, verify `getWebhookInfo` and a test update, then keep the old hosting running. Cloudflare code rollback does not roll back D1 or Durable Object data. Historical Supabase data was not touched and remains separate. D1 Time Travel and export are additional recovery tools; verify a backup before production use.
