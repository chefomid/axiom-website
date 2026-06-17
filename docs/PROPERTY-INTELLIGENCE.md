# Property Intelligence

À la carte **COPE underwriting** dossiers: public OSINT and government data first, escalate to **ATTOM** for carrier-credible property intelligence (CoreLogic/Cotality optional later).

## Route

`/property-intelligence`

## Stack

| Layer | Technology |
|-------|------------|
| UI | Property imagery (satellite + Street View) + source catalog + live receipt + COPE results |
| API | FastAPI + source registry + COPE merger + quote/enrich pipeline |
| Public | Census geocode, FEMA, USGS, NWS, OSM, hydrant/fire GIS, Crawl4AI |
| Standard paid | RentCast, Regrid, Melissa |
| Insurance-grade | ATTOM (CoreLogic/Cotality when enabled), First Street |
| Intelligence | COPE mapper, conflict resolution, PDF dossier, optional AI web property research |

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

When `STRIPE_SECRET_KEY` is set on the server, users can buy credit packs (no login) or pay the exact report/discovery price via **Pay & Generate**. Credits are spent on **Find with AI** and **Generate**. See **[docs/BILLING-SETUP.md](./BILLING-SETUP.md)** for Stripe webhook, Render deploy, and local CLI setup.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/billing/packs` | Credit pack catalog |
| GET | `/billing/balance?anon_id=` | Wallet balance |
| GET | `/billing/checkout-preview` | Exact charge preview for enrich or discover |
| POST | `/billing/checkout` | Start Stripe Checkout (credit pack) |
| POST | `/billing/checkout-quote` | Start Stripe Checkout (exact amount) |
| POST | `/billing/stripe-webhook` | Stripe events (server only) |

## Public record page URLs (manual or AI-assisted)

Some crawl sources (currently `assessor_crawl` and `permit_crawl`) require public URLs. You can:

- Enter URLs manually (one per crawl source), or
- Use **Find with AI**, which runs server-side OpenAI web search and returns suggested official public pages.

AI discovery requires `OPENAI_API_KEY` on the server. Users do not need to log in. The UI shows the estimated cost for discovery before running a report.

## AI web property research (insurance-grade add-on)

When **COPE (insurance-grade)** is selected and `OPENAI_API_KEY` is configured, an optional **Add web search** checkbox appears. It runs OpenAI web search during report generation to pull public assessor, permit, and listing facts into COPE fields — complementary to ATTOM and separate from public OSINT GIS adapters (hydrants, fire stations, OSM).

This is distinct from **Find with AI** (assessor/permit portal URL discovery for crawl sources). Web property research enriches COPE values directly and participates in conflict resolution when multiple sources disagree.

## Image construction analysis — Property Inspector agent (optional add-on)

When `OPENAI_API_KEY` is configured and an address is locked on the map, an optional **Add image analysis** checkbox appears on any preset. During enrichment the **Property Inspector** agent runs a multi-phase pipeline:

| Phase | Model / tool | Purpose |
|-------|----------------|---------|
| 1. Orient | Deterministic + Google/OSM APIs | Street View metadata, bearing to subject, capture up to 4 aimed views + satellite |
| 2. Select | `gpt-4o-mini` (low detail) | Pick the facade that shows the subject building; early exit if not identifiable |
| 3. Analyze | `gpt-4o` (high detail) | Extract materials, roof cues, floor bands, and story count on the selected view |
| Post | Python | ISO class inference, COPE field mapping, standardized **Markdown inspection digest** |

Outputs:

- **COPE fields** — construction type, ISO class, roof type, stories (supporting source; ATTOM/CoreLogic win on precedence)
- **Image tab** — summary, floor bands, agent trace (headings captured, models used), inspection digest
- **COPE PDF** — Image analysis section rendered from the digest when exported

**Cost target:** ~$0.04–0.06/run (within the `vision_construction` source budget).

**Environment:**

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | Vision model inference |
| `GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_MAPS_API_KEY` | Recommended | Street View Static on the server; without it, analysis runs **satellite-only** |

**Disclaimer:** Image analysis is an AI-assisted visual estimate from the Property Inspector agent. Verify against vendor records, assessor data, or inspection before underwriting.

Report results include an **Image** tab with evidence, ISO rationale, agent trace, inspection digest (Markdown), limitations, and imagery sources when this add-on runs.

Implementation: [`services/property-api/agents/property_inspector/`](../services/property-api/agents/property_inspector/)

## SOV orchestrator (insurance-grade presets)

Insurance-grade presets include **`sov_orchestrator`**, which replaces the legacy per-field conflict resolver. After all sources complete (vendors, web research, Property Inspector, crawls), the orchestrator:

| Lane | Sources |
|------|---------|
| **vendor_api** | ATTOM, Melissa, RentCast, CoreLogic |
| **online_public** | Web property research, assessor/permit crawls, OSM |
| **visual_ai** | Property Inspector (`vision_construction`) |

The orchestrator runs deterministic precedence first, then (when multiple lanes disagree or critical SOV fields are missing) a single **`gpt-4o-mini`** reconciliation pass. Outputs:

- **Statement of Values** — enriched schedule (construction + occupancy value fields)
- **SOV tab** — schedule table, discrepancies, enrichments, underwriter notes, Markdown digest
- **COPE snapshot** — updated trusted values when discrepancies are resolved
- **COPE PDF** — Statement of Values section after the COPE table

Skips the LLM when only one lane has data or deterministic resolution is complete (no extra cost).

Implementation: [`services/property-api/agents/sov_orchestrator/`](../services/property-api/agents/sov_orchestrator/)

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

## Path A — local demo (no Stripe required)

For internal demos, run `npm run dev:all` without `STRIPE_SECRET_KEY`. Enrichment uses **dry-run receipts** (no credit charges). The Credits wallet is hidden when billing is off.

### Demo checklist

1. `npm run check:property-keys` — confirm RentCast, ATTOM, Melissa, OpenAI (optional: Google Maps in `.env.local`)
2. Open `/property-intelligence` and pick **Property dossier** (or **Publicly available** for a no-vendor-fee demo)
3. Enter a full US address → confirm live quote → **Generate**
4. Review report tabs: **COPE**, **Sources**, **Hazards**, **Conflicts** (and **Image** when image analysis is enabled)
5. Click **Export COPE PDF** (requires Playwright/Chromium: `python -m playwright install chromium` in `services/property-api`)
6. Click **Export COPE Excel** — downloads immediately in the browser (no server dependency)

### Presets

| Preset | Best for |
|--------|----------|
| **Publicly available** | Public OSINT + government hazards + EPA ECHO + COPE mapper |
| **COPE (insurance-grade)** | ATTOM property + hazard + protection GIS + PDF dossier; optional OpenAI web search add-on |
| **Property basics** | RentCast + FEMA + USGS |

**Property dossier** is the recommended preset when testing licensed COPE completeness with configured API keys.

## Report results UI

After generation, the results panel includes tabs for COPE snapshot, per-source fields (plus crawl excerpt when present), hazard payloads, and source conflicts. **Export COPE PDF** builds a dossier via `POST /reports/pdf` using the same Playwright pipeline as seismic reports. **Export COPE Excel** generates a styled Summary + COPE workbook entirely in the browser (no Playwright or report API required).

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
