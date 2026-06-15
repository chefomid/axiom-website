# Backend Architecture

FastAPI property intelligence API at `services/property-api/` (v0.4.0).

**Run:** `npm run property-api:dev` or `uvicorn main:app --reload --port 8000 --app-dir services/property-api`

---

## Entry point

`main.py` — FastAPI app with lifespan (billing DB init), CORS, and all HTTP routes.

Supporting modules:

| File | Role |
|------|------|
| `geocode.py` | Census → Nominatim → Photon fallback geocoding |
| `env_loader.py` | Loads `.env.local` (repo root) + `services/property-api/.env` |
| `registry_loader.py` | Loads and resolves sources, presets, dependencies |

---

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service + billing status |
| GET | `/catalog` | Sources, categories, presets, vendors, pricing |
| GET | `/suggest` | Address autocomplete |
| GET | `/env-status` | Configured API key names (no values) |
| POST | `/quote` | Price estimate (no charge) |
| POST | `/discover-source-urls` | AI discovery of assessor/permit URLs |
| POST | `/enrich` | **Main report run** |
| GET | `/billing/packs` | Credit pack catalog |
| GET | `/billing/balance` | Wallet balance by `anon_id` |
| POST | `/billing/checkout` | Stripe Checkout session |
| POST | `/billing/stripe-webhook` | Stripe webhook → credit wallet |
| POST | `/reports/pdf` | Direct PDF from document JSON |
| POST | `/reports/sessions` | Create ephemeral report session |
| GET | `/reports/sessions/{id}/pdf` | PDF from session |

---

## Enrich pipeline (`POST /enrich`)

The core orchestration in `main.py`:

```
1. geocode_address(address)
2. build_quote(selected sources)
3. require_and_spend(anon_id, credits)  → 402 if insufficient
4. merge_source_urls(user URLs)
5. auto_resolve_crawl_urls(AI + jurisdiction fallback)
6. run_report(ctx) via engine.executor
7. Merge fields + hazards from SourceRunResults
8. build_final_receipt
9. If cope_map selected:
     collect_observations → resolve_all → build_cope_snapshot
10. Return EnrichResponse
```

Crawl4AI is invoked inline via `crawl_url()` when crawl sources have URLs.

---

## Three-layer architecture

### 1. Catalog (what exists)

| File | Role |
|------|------|
| `registry/sources.json` | ~30 sources: pricing, categories, `depends_on`, execution config |
| `registry/presets.json` | Bundled source selections |
| `registry/cope_fields.json` | COPE schema: sections, types, tolerance, source precedence |
| `registry/mappings/*.yaml` | Vendor JSON → COPE field mappings |

`resolve_selected_sources()` always adds `geocode_census` and expands `depends_on` transitively.

### 2. Engine (how to run)

| File | Role |
|------|------|
| `engine/models.py` | `SourceContext`, `SourceRunResult`, `Observation`, `TrustedValue` |
| `engine/adapter.py` | `SourceAdapter` protocol + `BaseAdapter` |
| `engine/registry.py` | Lazy singleton: `source_id` → adapter (28 instances) |
| `engine/planner.py` | `build_execution_plan()` — topological stages + post-process |
| `engine/executor.py` | `run_report`, parallel fetch, cache, validation, timeouts |
| `engine/cache.py` | In-memory TTL cache keyed by `(source_id, lat, lng, address_hash)` |
| `engine/normalize.py` | YAML mappings → `Observation`; value normalization |

**Per-source execution (`_run_one_source`):**

1. Check cache (`execution.cache_ttl_seconds` from sources.json)
2. Validate API key, `needs_source_url`
3. `adapter.fetch()` with timeout (default 25s)
4. `result_with_observations()` → cache on success

**Skipped from fetch:**
- `geocode_census` — handled in `run_geocode`
- Post-process stubs: `cope_map`, `llm_conflict_resolve`, `pdf_dossier`, `llm_extract`

**Post-process behavior:**
- `llm_conflict_resolve` — runs adapter with `ctx.all_observations` populated
- `cope_map`, `pdf_dossier`, `llm_extract` — synthetic success; real work in `main.py` or client

### 3. Planner (pricing)

| File | Role |
|------|------|
| `planner/quote.py` | `build_quote`, line items, `(api + service) × 2.5` margin |
| `planner/runner.py` | Re-exports `run_report`, `run_geocode` from engine |

---

## Adapters

Registered in `engine/registry.py`. Layout after recent refactor:

```
adapters/
├── base.py              # success_result, failed_result, skipped_result
├── hazard_fetch.py      # Shared HTTP fetchers (FEMA, NWS, USGS, wildfire, AQI, EPA, OSM)
├── osint.py             # Shared OSINT fetchers (POI, fire station, hydrant)
├── hazards/             # Thin hazard adapters (one file per source)
├── osint/               # Thin OSINT adapters
├── vendors/             # RentCast, Melissa, ATTOM, Regrid, First Street, CoreLogic
├── crawl/               # Crawl4AI assessor/permit
└── services/            # web_property_research, conflict_resolve, post_process
```

### Hazard adapters

| File | source_id | Fetch helper |
|------|-----------|--------------|
| `hazards/fema.py` | `hazard_fema` | `fetch_fema_flood` |
| `hazards/nws.py` | `hazard_nws` | `fetch_nws_alerts` |
| `hazards/usgs.py` | `hazard_usgs` | `fetch_usgs_seismic` |
| `hazards/wildfire.py` | `hazard_wildfire` | `fetch_wildfire_eonet` |
| `hazards/aqi.py` | `hazard_aqi` | `fetch_aqi_openmeteo` |
| `hazards/epa.py` | `hazard_epa` | `fetch_epa_echo` |

### Vendor adapters

| Adapter | source_id | Env key | Mapping YAML |
|---------|-----------|---------|--------------|
| `rentcast.py` | `rentcast_property` | `RENTCAST_API_KEY` | `rentcast_property.yaml` |
| `melissa.py` | `melissa_property` | `MELISSA_LICENSE_KEY` | `melissa_property.yaml` |
| `attom.py` | `attom_property`, `attom_hazard` | `ATTOM_API_KEY` | `attom_property.yaml` |
| `regrid.py` | `regrid_parcel` | `REGRID_API_KEY` | `regrid_parcel.yaml` |
| `firststreet.py` | `firststreet_risk` | `FIRSTSTREET_API_KEY` | inline |
| `corelogic.py` | `corelogic_*` | `CORELOGIC_API_KEY` | not selectable |

### Web property research

`adapters/services/web_property_research.py`:
- Requires `OPENAI_API_KEY`
- OpenAI Responses API + web search
- Mapping: `registry/mappings/web_property_research.yaml`
- Distinct from "Find with AI" (URL discovery for crawl sources)

---

## COPE merger

| File | Role |
|------|------|
| `merger/trust.py` | `collect_observations_from_results`, `resolve_all`, conflict detection |
| `merger/cope.py` | `build_cope_snapshot_from_trusted`, field aliases, unknown notes |

**Resolution methods:** `unanimous`, `precedence` (from cope_fields.json), `tolerance` (numeric %), `llm` (via conflict adapter).

**Where COPE is built:** In `main.enrich()` when `"cope_map"` is selected:

1. `collect_observations_from_results(run_results)`
2. `resolve_all(observations)` → `trusted`, `conflicts`
3. If `llm_conflict_resolve` ran → use LLM overrides
4. `build_cope_snapshot_from_trusted(trusted, conflicts=...)`

---

## Source discovery

| File | Role |
|------|------|
| `source_discovery/discover.py` | OpenAI web search → assessor/permit URLs |
| `source_discovery/resolve.py` | `auto_resolve_crawl_urls` during enrich |
| `source_discovery/jurisdiction.py` | Curated portal table + Nominatim reverse geocode |
| `source_discovery/url_validate.py` | HTTPS-only, no private IPs, reachability |
| `source_discovery/cache.py` | 24h in-memory discovery cache |

**Auto-resolve order during enrich:**
1. User-provided URLs
2. AI discovery (`strict_reachability=False`)
3. Jurisdiction table fallback

---

## Billing

Active when `STRIPE_SECRET_KEY` is set.

| File | Role |
|------|------|
| `billing/config.py` | `billing_enabled()` |
| `billing/db.py` | Postgres or SQLite (`data/billing.sqlite`) |
| `billing/gate.py` | `require_and_spend` → HTTP 402 |
| `billing/credits.py` | ~10 credits per $1 user price |
| `billing/packs.py` | $5/55, $25/300, $100/1300 |
| `billing/stripe_service.py` | Checkout + webhook credit top-up |

**Gating:**
- `/discover-source-urls` — charges if billing enabled and not cached
- `/enrich` — always calls `require_and_spend` (no-op if billing disabled)
- `/quote` — no charge

---

## LLM layer

`llm/openai_client.py` — used by:
- `source_discovery/discover.py` — URL discovery
- `adapters/services/web_property_research.py` — property field research
- `adapters/services/conflict_resolve.py` — conflict reconciliation

Requires `OPENAI_API_KEY`.

---

## How to add a new source

1. Create adapter in `adapters/` (follow hazards or vendors pattern)
2. Register in `engine/registry.py` → `get_adapter(source_id)`
3. Add entry to `registry/sources.json` (pricing, category, depends_on, etc.)
4. Optional: YAML mapping in `registry/mappings/` for vendor JSON → COPE fields
5. Frontend catalog auto-updates via `GET /catalog` — no frontend changes needed unless UI customization required

---

## See also

- [06-data-flows.md](./06-data-flows.md) — enrich pipeline diagram
- [10-known-gaps-and-stubs.md](./10-known-gaps-and-stubs.md) — incomplete adapters
- [../PROPERTY-INTELLIGENCE.md](../PROPERTY-INTELLIGENCE.md) — API endpoints and presets
