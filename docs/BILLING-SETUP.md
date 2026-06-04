# Property Intelligence — prepaid credits (Stripe)

Anonymous users buy **credit packs** via Stripe Checkout (Apple Pay / Google Pay / card on mobile), then spend credits on **Find with AI** and **Generate report**.

## Security

- Never commit API keys. Use `.env.local` (repo root) or Render environment variables.
- If a key was pasted in chat or committed, **rotate it** in [Stripe Dashboard](https://dashboard.stripe.com/apikeys) and [OpenAI API keys](https://platform.openai.com/api-keys).

## Local development

1. Copy env templates:
   - [`.env.example`](../.env.example)
   - [`services/property-api/.env.example`](../services/property-api/.env.example)

2. Set on the server (property API):

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   OPENAI_API_KEY=sk-...
   FRONTEND_URL=http://127.0.0.1:5173
   ```

3. **Database**: omit `DATABASE_URL` for local dev — the API uses SQLite at `services/property-api/data/billing.sqlite` (gitignored).

4. **Stripe webhook (local)** — use [Stripe CLI](https://stripe.com/docs/stripe-cli).

   **Windows (first time):** install CLI, then open a **new** terminal so `stripe` is on PATH:

   ```powershell
   winget install Stripe.StripeCli
   stripe login
   ```

   Forward webhooks to the API (leave this running in its own terminal):

   ```powershell
   stripe listen --forward-to http://127.0.0.1:8000/billing/stripe-webhook
   ```

   Copy the CLI `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart `npm run dev:all`.

5. Restart: `npm run dev:all`

6. In the UI: open Property Intelligence → **Credits** in the header → buy a test pack → return with `?billing=success`.

## Credit packs (defaults)

| Pack | Price | Credits |
|------|-------|---------|
| pack_5 | $5 | 55 |
| pack_25 | $25 | 300 |
| pack_100 | $100 | 1300 |

Usage costs: ~10 credits per $1 of estimated report price (see `billing/credits.py`).

## Production (Render — recommended)

The repo already deploys [`services/property-api`](../services/property-api) via [`render.yaml`](../render.yaml) as **axiom-report-api**.

1. [Render Dashboard](https://dashboard.render.com/) → open **axiom-report-api** (or deploy Blueprint from repo).

2. **Upgrade plan** off free tier if you need fast webhooks after idle (Starter recommended).

3. **PostgreSQL**: New → PostgreSQL → copy **Internal Database URL** → set as `DATABASE_URL` on the web service.

4. **Environment variables** on the web service:

   | Variable | Purpose |
   |----------|---------|
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint |
   | `OPENAI_API_KEY` | AI URL discovery |
   | `DATABASE_URL` | Postgres connection string |
   | `FRONTEND_URL` | `https://www.axiompropertycasualty.com` |

5. **Stripe webhook** — [Stripe Webhooks](https://dashboard.stripe.com/webhooks):

   - Endpoint URL: `https://<your-render-host>/billing/stripe-webhook`
   - Events: `checkout.session.completed`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

6. **Vercel** (frontend) — [Environment Variables](https://vercel.com/docs/projects/environment-variables):

   - `VITE_PROPERTY_API_URL` = `https://<your-render-host>` (no trailing slash)

7. Verify:

   ```bash
   curl https://<your-render-host>/health
   curl https://<your-render-host>/billing/packs
   ```

## API endpoints

| Method | Path |
|--------|------|
| GET | `/billing/packs` |
| GET | `/billing/balance?anon_id=...` |
| POST | `/billing/checkout` — body `{ anon_id, pack_id }` |
| POST | `/billing/stripe-webhook` — Stripe only |

Chargeable actions return **402** when credits are insufficient.

## Smoke tests

**API (no Stripe payment)** — from repo root with property-api deps installed:

```powershell
npm run smoke:billing
```

**End-to-end (mobile-friendly Checkout)** — after deploy + webhook:

1. On a phone (or narrow browser), open Property Intelligence on production.
2. Tap **Credits** → choose a pack → complete Checkout (test card `4242…` in test mode).
3. Confirm redirect to `?billing=success` and balance updates in the header.
4. Run **Find with AI** on an address with crawl sources selected — should succeed if balance covers discovery.
5. **Generate** — should deduct credits; if balance is too low, UI shows add-credits notice (HTTP 402).

Local E2E: `stripe listen --forward-to http://127.0.0.1:8000/billing/stripe-webhook`, set `STRIPE_*` keys, buy pack from `http://127.0.0.1:5173/property-intelligence`.

## Links

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- [Stripe wallets (Apple Pay / Google Pay)](https://docs.stripe.com/payments/wallets)
