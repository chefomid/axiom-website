# Property Intelligence API

Python service for property enrichment (Crawl4AI), geocoding, and **seismic report PDF generation** (Playwright).

## Setup

```powershell
cd services/property-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Optional property crawling (Crawl4AI — heavier deps):

```powershell
python -m pip install -r requirements-crawl4ai.txt
crawl4ai-setup
```

On Linux (Railway / Fly.io):

```bash
pip install -r requirements.txt
playwright install chromium --with-deps
```

## Run (local)

```powershell
# From repo root — frontend + API together
npm run dev:all

# Or API only
uvicorn main:app --reload --port 8000
```

Set `FRONTEND_URL=http://127.0.0.1:5173` so Playwright can load the print preview route (must match the Vite dev URL).

## Endpoints

### Property Intelligence

- `GET /health`
- `GET /catalog`, `GET /presets`
- `POST /quote` — live receipt for address + selected sources
- `POST /discover-source-urls` — AI-assisted public crawl URLs (OpenAI + web search)
- `POST /enrich` — run report; body includes `address`, `selected_sources`, optional `source_urls`, `anon_id`

### Prepaid credits (Stripe)

When `STRIPE_SECRET_KEY` is set, anonymous wallets are charged before **Find with AI** and **Generate**. Full setup: **[docs/BILLING-SETUP.md](../../docs/BILLING-SETUP.md)**.

| Method | Path |
|--------|------|
| GET | `/billing/packs` |
| GET | `/billing/balance?anon_id=` |
| POST | `/billing/checkout` — `{ anon_id, pack_id }` → `{ url }` |
| POST | `/billing/stripe-webhook` — Stripe only (signature required) |

Insufficient balance returns **402** with `{ needed_credits, balance_credits, action }`.

Smoke test (no payment): from repo root, `npm run smoke:billing`.

### Seismic Report PDF

- `GET /reports/health`
- `POST /reports/sessions` — body: `{ "document": { ...ReportDocument } }` → `{ "sessionId": "..." }`
- `GET /reports/sessions/{sessionId}` — returns stored document for print preview
- `POST /reports/sessions/{sessionId}/pdf` — Playwright renders `{FRONTEND_URL}/reports/print/{sessionId}` → PDF bytes

Sessions expire after 15 minutes (`REPORT_SESSION_TTL_SECONDS`, default 900).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | `http://127.0.0.1:5173` | Vite dev server or production Vercel URL (print route + Stripe Checkout return URLs) |
| `REPORT_SESSION_TTL_SECONDS` | `900` | Session cache TTL |
| `OPENAI_API_KEY` | — | AI URL discovery (`POST /discover-source-urls`) |
| `STRIPE_SECRET_KEY` | — | Enables billing; omit for dry-run receipts only |
| `STRIPE_WEBHOOK_SECRET` | — | Verifies `POST /billing/stripe-webhook` |
| `DATABASE_URL` | — | Postgres in production; local dev uses SQLite under `data/billing.sqlite` |
| Vendor keys | — | `ATTOM_API_KEY`, `RENTCAST_API_KEY`, etc. — see `.env.example` |

## Frontend configuration

Local dev uses the Vite proxy: `/api/reports` → `http://127.0.0.1:8000/reports`.

Production (Vercel static site) must point at a deployed API (same host recommended):

```env
VITE_PROPERTY_API_URL=https://your-property-api.example.com
VITE_REPORT_API_URL=https://your-property-api.example.com/reports
```

If unset in production, the client falls back to `/api/property` and `/api/reports` (requires a reverse proxy).

## Production deployment (Render — required for PDF)

Playwright/Chromium **cannot run on Vercel serverless**. Production PDFs use this API on Render; Vercel proxies `/api/reports/*` to it via `REPORT_API_URL`.

### One-time setup

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect `chefomid/axiom-website`.
2. Render reads `render.yaml` and creates `axiom-report-api` (Docker + Playwright).
3. Copy the service URL (e.g. `https://axiom-report-api.onrender.com`).
4. Render web service → **Environment** → add (Dashboard → sync: false in [`render.yaml`](../../render.yaml)):
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`
   - `DATABASE_URL` — from Render PostgreSQL (or external Postgres)
5. [Stripe Webhooks](https://dashboard.stripe.com/webhooks) → endpoint `https://axiom-report-api.onrender.com/billing/stripe-webhook`, event `checkout.session.completed`.
6. Vercel → **Environment Variables** (Production):
   - `VITE_PROPERTY_API_URL` = `https://axiom-report-api.onrender.com`
   - `REPORT_API_URL` = `https://axiom-report-api.onrender.com/reports` (server-side PDF proxy)
7. Redeploy Vercel and Render after env changes.

Verify:

```bash
curl https://axiom-report-api.onrender.com/health
curl https://axiom-report-api.onrender.com/billing/packs
curl https://axiom-report-api.onrender.com/reports/health
npm run smoke:billing
```

Local dev is unchanged: `npm run dev:all` proxies `/api/reports` → `localhost:8000/reports`.

## Production deployment (Railway or Fly.io — alternative)

The Vercel frontend cannot run Playwright. Deploy this service separately.

### Railway

1. New project → deploy from repo, set **Root Directory** to `services/property-api`.
2. **Build command:** `pip install -r requirements.txt && playwright install chromium --with-deps`
3. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Environment:
   - `FRONTEND_URL=https://www.axiompropertycasualty.com`
   - `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`
   - `PORT` (Railway sets automatically)
5. Stripe webhook → `https://<service>.up.railway.app/billing/stripe-webhook`
6. Vercel: `VITE_PROPERTY_API_URL=https://<service>.up.railway.app` and `VITE_REPORT_API_URL=.../reports`

### Fly.io

```bash
cd services/property-api
fly launch --no-deploy
```

Example `Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Set secrets:

```bash
fly secrets set FRONTEND_URL=https://www.axiompropertycasualty.com
```

### CORS

Production origins are allowed in `main.py`:

- `https://www.axiompropertycasualty.com`
- `https://axiompropertycasualty.com`

Add preview domains if needed.

## PDF flow

1. User clicks **Download PDF** in the seismic report viewer.
2. Frontend builds `ReportDocument`, validates it, `POST /reports/sessions`.
3. API stores JSON, returns `sessionId`.
4. API launches Chromium, opens `/reports/print/{sessionId}`, waits for `#report-print-ready`, exports Letter PDF.
5. Browser saves `seismic-report-{location}.pdf`.

Until the API is deployed, production downloads show: *Report PDF service unavailable.*

Respect Nominatim usage policy (low rate, attribution). Crawl only public pages allowed by their terms.
