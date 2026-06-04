# Property Intelligence

À la carte **COPE underwriting** dossiers: free OSINT and government data first, escalate to **ATTOM** for carrier-credible property intelligence (CoreLogic/Cotality optional later).

## Route

`/property-intelligence`

## Stack

| Layer | Technology |
|-------|------------|
| UI | Property imagery (satellite + Street View) + source catalog + live receipt + COPE results |
| API | FastAPI + source registry + COPE merger + quote/enrich pipeline |
| Free | Census geocode, FEMA, USGS, NWS, OSM, hydrant/fire GIS, Crawl4AI |
| Standard paid | RentCast, Regrid, Melissa |
| Insurance-grade | ATTOM (CoreLogic/Cotality when enabled), First Street |
| Intelligence | COPE mapper, conflict resolution, PDF dossier |

## Local development

Terminal 1 — property API:

```powershell
cd services/property-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
crawl4ai-setup
uvicorn main:app --reload --port 8000
```

Or from repo root: `npm run property-api`

Terminal 2 — Vite (proxies `/api/property` → `localhost:8000`):

```powershell
npm run dev
```

## Superpowers (agent methodology)

Installed under `.cursor/superpowers/` with project rules in `.cursor/rules/superpowers.mdc`.

Reinstall: `npm run install:superpowers`

Optional marketplace plugin (auto-updates): in Cursor Agent chat run `/add-plugin superpowers` — see [obra/superpowers](https://github.com/obra/superpowers).

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/catalog` | Source groups, presets, default selection |
| POST | `/discover-source-urls` | AI-assisted discovery of public assessor / permit portal pages (optional) |
| POST | `/quote` | Live receipt for address + selected sources |
| POST | `/enrich` | Run report + final receipt |

Pricing: `(API cost + service cost) × 2.5` from `registry/sources.json`.

## Prepaid credits (Stripe)

When `STRIPE_SECRET_KEY` is set on the server, users can buy credit packs (no login). Credits are spent on **Find with AI** and **Generate**. See **[docs/BILLING-SETUP.md](./BILLING-SETUP.md)** for Stripe webhook, Render deploy, and local CLI setup.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/billing/packs` | Credit pack catalog |
| GET | `/billing/balance?anon_id=` | Wallet balance |
| POST | `/billing/checkout` | Start Stripe Checkout |
| POST | `/billing/stripe-webhook` | Stripe events (server only) |

## Public record page URLs (manual or AI-assisted)

Some crawl sources (currently `assessor_crawl` and `permit_crawl`) require public URLs. You can:

- Enter URLs manually (one per crawl source), or
- Use **Find with AI**, which runs server-side OpenAI web search and returns suggested official public pages.

AI discovery requires `OPENAI_API_KEY` on the server. Users do not need to log in. The UI shows the estimated cost for discovery before running a report.

## Deep link to hazards

After enrichment, **View live hazards at this location** opens Public Data Command with `?lat=&lng=&scope=local`.

## Property imagery

| Tab | Source | API key |
|-----|--------|---------|
| Satellite | Esri World Imagery | None |
| Street | Google Metadata (coverage) + Maps Embed (panorama) | `VITE_GOOGLE_MAPS_API_KEY` |

Setup: **[docs/GOOGLE-MAPS-SETUP.md](./GOOGLE-MAPS-SETUP.md)** — step-by-step Google Cloud instructions.

Copy `.env.example` → `.env.local` and add keys. The property API loads **both** `.env.local` (repo root) and `services/property-api/.env`.

Check keys: `npm run check:property-keys` or click **Vendor keys** in the Property Intelligence header.

Restart after changing env vars: `npm run dev:all`

## Production

Deploy the same [`services/property-api`](../services/property-api) host for enrichment, billing webhooks, and PDF reports — see [`render.yaml`](../render.yaml) and **[docs/BILLING-SETUP.md](./BILLING-SETUP.md)**.

### Feature gate (Coming Soon on production)

Property Intelligence is **off in production builds by default**. `/property-intelligence` shows a “Coming Soon” placeholder until you explicitly enable the full app.

| Environment | Behavior |
|-------------|----------|
| `npm run dev` | Full app (always enabled) |
| Vercel production | Coming Soon unless `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` |
| Vercel preview | Set `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` to test PI before launch |

To simulate production locally: add `VITE_PROPERTY_INTELLIGENCE_ENABLED=false` to `.env.local`, then `npm run build && npm run preview`.

Logic lives in [`src/config/features.js`](../src/config/features.js).

### Vercel env vars

| Variable | When to set | Example |
|----------|-------------|---------|
| `REPORT_API_URL` | Always (Public Data Command PDF proxy) | `https://axiom-report-api.onrender.com/reports` |
| `VITE_PROPERTY_INTELLIGENCE_ENABLED` | When launching PI | `true` |
| `VITE_PROPERTY_API_URL` | When launching PI | `https://axiom-report-api.onrender.com` |
| `VITE_GOOGLE_MAPS_API_KEY` | When launching PI Street View | See [GOOGLE-MAPS-SETUP.md](./GOOGLE-MAPS-SETUP.md) |

While PI is gated, omit `VITE_PROPERTY_INTELLIGENCE_ENABLED`, `VITE_PROPERTY_API_URL`, and `VITE_GOOGLE_MAPS_API_KEY` on Vercel.

### Launch checklist

1. Set `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` on Vercel → redeploy
2. Set `VITE_PROPERTY_API_URL=https://axiom-report-api.onrender.com` on Vercel
3. Set `VITE_GOOGLE_MAPS_API_KEY` if Street View is needed ([GOOGLE-MAPS-SETUP.md](./GOOGLE-MAPS-SETUP.md))
4. Configure Stripe on Render per [BILLING-SETUP.md](./BILLING-SETUP.md)

Verify: `npm run smoke:billing` (local API) and mobile Checkout checklist in BILLING-SETUP.
