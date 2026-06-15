# Repository Map

Annotated directory tree for the AXIOM website monorepo.

---

## Top level

```
website/
├── src/                          # React 18 + Vite frontend
├── services/property-api/        # FastAPI backend (v0.4.0)
├── docs/                         # Technical documentation
│   └── agent-handoff/            # ← You are here (continuity package)
├── scripts/                      # Utility scripts (keys check, billing smoke, superpowers install)
├── public/                       # Static assets (favicon, data files, agency SVG logos)
├── InsuranceManager/             # Separate product — marketing kit only, not website code
├── render.yaml                   # Render.com deploy config for property-api
├── vite.config.js                # Vite dev server + API proxies
├── tailwind.config.js            # Design tokens
├── package.json                  # Frontend scripts and dependencies
└── AGENTS.md                     # Cursor agent entry point
```

---

## Frontend (`src/`)

```
src/
├── App.jsx                       # React Router (createBrowserRouter)
├── main.jsx                      # Entry point; imports index.css
├── index.css                     # Global styles, map markers, reticle, scanline effects (~1,680 lines)
├── config/
│   └── features.js               # Property Intelligence feature gate
├── constants/
│   └── routes.js                 # Route paths, labels, deep-link helpers
├── context/
│   └── TelemetryContext.jsx      # Live activity feed (Public Data Command only)
├── data/
│   └── commandMapData.js         # Feed source config (USGS, NWS, FEMA, NASA)
├── pages/                        # Thin route shells
│   ├── Home.jsx                  # Marketing landing
│   ├── PublicDataCommand.jsx     # → PublicDataCommandView
│   ├── PropertyIntelligence.jsx  # Feature gate + lazy PropertyIntelligenceView
│   ├── ReportPrint.jsx           # Headless PDF print target
│   └── BetterWorld.jsx           # LEGACY — not routed
├── components/
│   ├── better-world/             # Public Data Command (30 components; legacy folder name)
│   │   ├── PublicDataCommandView.jsx   # Main orchestrator
│   │   ├── CommandMap.jsx              # MapLibre map (~1,400+ lines)
│   │   ├── IntelligencePanel.jsx       # Live signals list
│   │   ├── DataSourcePanel.jsx         # Feed toggles
│   │   ├── MapControlsDock.jsx         # Map controls
│   │   └── ...                         # Earthquake analysis, report modals, etc.
│   ├── property-intelligence/    # Property Intelligence (27 components)
│   │   ├── PropertyIntelligenceView.jsx  # Main shell / state orchestration
│   │   ├── PropertySearchBar.jsx
│   │   ├── PropertyMap.jsx
│   │   ├── IntentPackagePicker.jsx
│   │   ├── LiveReceipt.jsx
│   │   ├── ReportResultsPanel.jsx      # COPE / Sources / Hazards / Conflicts tabs
│   │   ├── AdvancedDrawer.jsx
│   │   ├── SourceCatalog.jsx
│   │   └── ...
│   ├── report-print/             # PDF print layout (5 components)
│   ├── ui/                       # Shared primitives (2 files)
│   │   ├── CommandControls.jsx   # ToggleChip, DockButton, PanelSection
│   │   └── AddressGeocodeInput.jsx
│   ├── Nav.jsx                   # Global navigation
│   ├── AppErrorBoundary.jsx
│   ├── RouteErrorFallback.jsx
│   ├── CoiTrackerModal.jsx
│   └── InsuranceManagerModal.jsx
├── hooks/                        # 11 custom hooks
│   ├── usePropertyReport.js      # PRIMARY — PI catalog, quote, enrich, persistence
│   ├── usePropertyEnrichment.js  # LEGACY — superseded by usePropertyReport
│   ├── useUsgsEarthquakes.js
│   ├── useNwsAlerts.js
│   ├── useNasaFirms.js
│   ├── useFemaNfhl.js
│   ├── useMapPins.js
│   └── ...
├── services/                     # API clients (native fetch)
│   ├── propertyApi.js            # All Property Intelligence API calls
│   ├── geocode.js                # Census + Photon geocoding
│   ├── propertyImagery.js        # Google Street View, Esri satellite
│   ├── reportApi.js              # PDF session create/fetch/download
│   ├── usgsEarthquakes.js
│   ├── nwsAlerts.js
│   ├── nasaFirms.js
│   └── femaNfhl.js
├── utils/                        # Helpers (~26 files)
│   ├── copeReportDocument.js     # PDF document schema builder
│   ├── copeReportExcel.js        # Excel export (exceljs)
│   ├── lazyWithRetry.js          # Chunk load retry for lazy routes
│   ├── riskNormalize.js          # RiskEvent normalization (PDC)
│   ├── riskCache.js              # TTL cache for feeds
│   └── ...
├── lib/
│   ├── maplibre.js               # MapLibre import + CSS
│   └── mapCornerControls.js
└── styles/
    └── report-print.css          # Print/PDF layout
```

---

## Backend (`services/property-api/`)

```
services/property-api/
├── main.py                       # FastAPI app, all HTTP routes, enrich orchestration
├── geocode.py                    # Census → Nominatim → Photon fallback
├── env_loader.py                 # .env loading; /env-status endpoint
├── registry_loader.py            # Loads sources.json, presets.json; resolves dependencies
├── report_html.py                # COPE document → HTML
├── report_pdf.py                 # Playwright PDF; in-memory sessions (15 min TTL)
├── requirements.txt
├── Dockerfile                    # Render deploy
├── engine/                       # Execution runtime
│   ├── adapter.py                # SourceAdapter protocol + BaseAdapter
│   ├── registry.py               # source_id → adapter instance (28 adapters)
│   ├── executor.py               # run_report, parallel fetch, cache, validation
│   ├── planner.py                # build_execution_plan (topological stages)
│   ├── models.py                 # SourceContext, SourceRunResult, Observation
│   ├── normalize.py              # YAML mappings → Observation
│   └── cache.py                  # In-memory TTL cache
├── adapters/
│   ├── base.py                   # success_result, failed_result, skipped_result
│   ├── hazard_fetch.py           # Shared HTTP fetchers (FEMA, NWS, USGS, etc.)
│   ├── osint.py                  # Shared OSINT HTTP fetchers
│   ├── hazards/                  # Thin hazard adapters (fema, nws, usgs, wildfire, aqi, epa)
│   ├── osint/                    # Thin OSINT adapters (osm, poi, fire_station, hydrant, stubs)
│   ├── vendors/                  # RentCast, Melissa, ATTOM, Regrid, First Street, CoreLogic
│   ├── crawl/                    # Crawl4AI assessor/permit
│   └── services/                 # web_property_research, conflict_resolve, post_process stubs
├── registry/
│   ├── sources.json              # Source catalog (~30 sources), pricing, dependencies
│   ├── presets.json              # Bundled source selections
│   ├── cope_fields.json          # COPE schema, precedence, tolerance
│   └── mappings/                 # Vendor JSON → COPE field YAML mappings
│       ├── attom_property.yaml
│       ├── melissa_property.yaml
│       ├── rentcast_property.yaml
│       ├── regrid_parcel.yaml
│       └── web_property_research.yaml
├── merger/
│   ├── trust.py                  # collect_observations, resolve_all, conflict detection
│   └── cope.py                   # build_cope_snapshot_from_trusted
├── planner/
│   ├── quote.py                  # build_quote, line items, margin multiplier
│   └── runner.py                 # Re-exports from engine
├── source_discovery/
│   ├── discover.py               # OpenAI web search for assessor/permit URLs
│   ├── resolve.py                # auto_resolve_crawl_urls
│   ├── jurisdiction.py           # Curated portal table + Nominatim enrichment
│   ├── url_validate.py           # HTTPS-only, reachability checks
│   └── cache.py                  # 24h discovery cache
├── billing/
│   ├── config.py                 # billing_enabled() = Stripe key present
│   ├── db.py                     # Postgres or SQLite wallet + ledger
│   ├── gate.py                   # require_and_spend → 402 if insufficient
│   ├── credits.py                # Credit conversion (~10 credits per $1)
│   ├── packs.py                  # Credit pack catalog
│   └── stripe_service.py         # Checkout + webhook
└── llm/
    └── openai_client.py          # chat_completion, responses_with_web_search
```

---

## Scripts (`scripts/`)

| Script | npm command | Purpose |
|--------|-------------|---------|
| `check_property_keys.py` | `npm run check:property-keys` | Validate vendor API keys |
| `smoke_billing.py` | `npm run smoke:billing` | Billing smoke test |
| `install-superpowers.ps1` | `npm run install:superpowers` | Install Cursor Superpowers skills |

---

## Docs (`docs/`)

| File | Purpose |
|------|---------|
| `agent-handoff/` | This continuity package |
| `PROPERTY-INTELLIGENCE.md` | PI setup, presets, demo, launch |
| `PUBLIC-DATA-COMMAND-ARCHITECTURE.md` | PDC feeds, RiskEvent, map layers |
| `BILLING-SETUP.md` | Stripe webhook, Render, local CLI |
| `GOOGLE-MAPS-SETUP.md` | Street View API setup |

---

## Static assets (`public/`)

| Path | Purpose |
|------|---------|
| `public/data-sources/*.svg` | Agency logos (FEMA, NASA, NWS, USGS) |
| `public/data/pb2002-boundaries.json` | Plate boundary data |
| `public/favicon.svg` | Site favicon |

---

## Out of repo scope

| Path | Notes |
|------|-------|
| `InsuranceManager/` | Marketing deliverable kit for a separate product; not part of the website app |

---

## See also

- [03-frontend-architecture.md](./03-frontend-architecture.md) — frontend patterns
- [04-backend-architecture.md](./04-backend-architecture.md) — backend patterns
- [../../AGENTS.md](../../AGENTS.md) — agent entry point
