# Property Intelligence — prepaid credits (Stripe)

Anonymous users buy **credit packs** via Stripe Checkout (Apple Pay / Google Pay / card on mobile), or pay the **exact amount** for a report or AI discovery at the point of action. Credits are spent on **Find with AI** and **Generate report**.

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
   STRIPE_PUBLISHABLE_KEY=pk_test_...
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

## Apple Pay on desktop (embedded checkout)

On desktop, checkout opens an embedded Stripe form with **Pay here** (default) and **Pay on phone** (QR) tabs.

- **Pay here** — Apple Pay, Google Pay, or card in the modal. On Chrome/Windows, Apple Pay shows an iOS 18+ **Scan with iPhone** code when the customer taps Apple Pay.
- **Pay on phone** — QR code opens hosted Stripe Checkout on the phone (same as before).

One-time Stripe Dashboard setup:

1. **Enable Apple Pay** — Settings → Payment methods → Apple Pay → ON
2. **Register your domain** — Settings → Payment methods → Payment method domains → add your production domain and `localhost` (test mode)
3. **Publishable key** — copy `pk_test_...` or `pk_live_...` into `STRIPE_PUBLISHABLE_KEY` on the property API (same place as `STRIPE_SECRET_KEY`)

No Apple Developer Program membership is required for web Apple Pay via Stripe.

## Credit packs (defaults)

| Pack | Price | Credits |
|------|-------|---------|
| pack_5 | $5 | 55 |
| pack_25 | $25 | 300 |
| pack_100 | $100 | 1300 |

Usage costs: ~10 credits per $1 of estimated report price (see `billing/credits.py`).

## Exact-amount checkout (Pay & Generate)

When wallet balance is insufficient, the UI shows **Pay $X.XX & Generate** (or **Pay & Preview** for AI URL discovery) instead of requiring a credit pack first.

| Scenario | Charge |
|----------|--------|
| Zero balance | Full receipt price (e.g. $4.37) |
| Partial balance | Only the credit gap (e.g. need 44, have 10 → pay $3.40) |

The server recomputes the quote on every preview and checkout request. After payment, the user returns with `?billing=success&resume=enrich` or `resume=discover` and the action auto-resumes.

Credit packs in the header remain available for repeat buyers.

## Production (Render — recommended)

The repo already deploys [`services/property-api`](../services/property-api) via [`render.yaml`](../render.yaml) as **axiom-report-api**.

1. [Render Dashboard](https://dashboard.render.com/) → open **axiom-report-api** (or deploy Blueprint from repo).

2. **Upgrade plan** off free tier if you need fast webhooks after idle (Starter recommended).

3. **PostgreSQL**: New → PostgreSQL → copy **Internal Database URL** → set as `DATABASE_URL` on the web service.

4. **Environment variables** on the web service:

   | Variable | Purpose |
   |----------|---------|
   | `STRIPE_SECRET_KEY` | Stripe secret key |
   | `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (embedded checkout / Apple Pay on web) |
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
| GET | `/billing/checkout-preview?anon_id=&purpose=&address=&selected_sources=` |
| POST | `/billing/checkout` — body `{ anon_id, pack_id, embedded? }` |
| POST | `/billing/checkout-quote` — body `{ anon_id, purpose, address, selected_sources, confirmed_price_usd?, embedded? }` |
| POST | `/billing/stripe-webhook` — Stripe only |

Chargeable actions return **402** when credits are insufficient.

## Smoke tests

**API (no Stripe payment)** — from repo root with property-api deps installed:

```powershell
npm run smoke:billing
```

**End-to-end (desktop Apple Pay + mobile)** — after deploy + webhook:

1. **Desktop (Chrome on Windows):** open Property Intelligence → trigger checkout → **Pay here** tab → click Apple Pay → scan with iPhone (iOS 18+) or pay with card.
2. **Desktop QR fallback:** same checkout → **Pay on phone** tab → scan QR → pay on phone → desktop detects credits via polling.
3. On a phone (or narrow browser), open Property Intelligence. If balance is insufficient, tap **Pay $X.XX & Generate** — redirects to hosted Stripe Checkout.
4. Complete Checkout (test card `4242…` in test mode). Confirm redirect to `?billing=success&resume=enrich` and report auto-runs.
5. Alternatively, tap **Credits** → choose a pack → return with `?billing=success`.
6. For crawl presets, use **Pay & Preview** on public record sources when balance is low.
7. **Generate** deducts credits when balance is sufficient; HTTP 402 if not.

Local E2E: `stripe listen --forward-to http://127.0.0.1:8000/billing/stripe-webhook`, set `STRIPE_*` keys, pay from `http://127.0.0.1:5173/property-intelligence`.

## Links

- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- [Stripe embedded Checkout](https://docs.stripe.com/checkout/embedded/quickstart)
- [Stripe wallets (Apple Pay / Google Pay)](https://docs.stripe.com/payments/wallets)
