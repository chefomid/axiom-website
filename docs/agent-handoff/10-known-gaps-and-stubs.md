# Known Gaps and Stubs

Incomplete work, production limitations, and legacy code. Do not assume these are finished.

---

## Backend stubs (always skipped or no-op)

| Source ID | Status | Notes |
|-----------|--------|-------|
| `openaddresses_lookup` | Always skipped | Message: county auto-discovery not implemented |
| `county_parcel_arcgis` | Always skipped | Same — needs county-specific adapter |
| `corelogic_property` | Adapter exists, not selectable | Not in catalog; enable when keys available |
| `corelogic_spatial` | Adapter exists, not selectable | Same |
| `llm_extract` | Post-process stub | Returns synthetic success; no LLM crawl extraction |
| `pdf_dossier` | Billing line item only | PDF generated client-side via report sessions |
| `cope_map` | Computed in `main.py` | Not in adapter fetch; synthetic success row in executor |

---

## Production limitations

| Item | Current state | Needed for production |
|------|---------------|----------------------|
| Source response cache | In-memory (`engine/cache.py`) | Redis or similar |
| Discovery cache | In-memory, 24h TTL | Redis |
| Report sessions | In-memory, 15 min TTL | Acceptable for PDF; consider persistence for audit |
| Billing DB local | SQLite at `data/billing.sqlite` | Postgres via `DATABASE_URL` on Render |
| FEMA NFHL vector | 500 feature cap per bbox | Document or paginate |
| NWS national fetch | 500 alert cap; client-side bbox filter | Acceptable |
| AirNow | Coarse lat/lng grid | Rate limit workaround |
| FIRMS / AirNow without keys | Falls back to EONET / Open-Meteo | Telemetry warns in UI |

---

## Frontend gaps

| Item | Status |
|------|--------|
| Unit tests | None |
| E2e tests | None |
| TypeScript | Not used |
| `usePropertyEnrichment.js` | Legacy — superseded by `usePropertyReport` |
| `BetterWorld.jsx` | Not routed — legacy page |
| `better-world/` folder name | Mismatch with "Public Data Command" product name |

---

## Feature gaps (not yet built)

| Feature | Notes |
|---------|-------|
| County parcel auto-discovery | Stub adapters reference it; no implementation |
| CoreLogic enablement | Adapters coded; catalog entries commented/disabled |
| `llm_extract` | Would extract COPE fields from crawl HTML via LLM |
| Redis cache swap | Commented in cache modules |
| Production NWS proxy | Vercel needs reverse proxy with User-Agent header for PDC |

---

## Insurance Manager

`InsuranceManager/` at repo root is a **separate product** — marketing deliverable kit (deck screenshots, MANIFEST.json). Not part of the website app. Do not confuse with Property Intelligence or Public Data Command.

---

## Billing edge cases

| Scenario | Behavior |
|----------|----------|
| No `STRIPE_SECRET_KEY` | Billing disabled; dry-run receipts; Credits wallet hidden |
| Webhook not configured locally | Checkout succeeds but credits not topped up until webhook forwarded |
| Insufficient credits | HTTP 402; frontend shows billing notice |

---

## Crawl4AI dependencies

Assessor and permit crawl sources require:
- `crawl4ai-setup` run once in property-api venv
- Valid public URLs (manual, AI discovery, or jurisdiction fallback)
- Crawl sources fail gracefully if URL unreachable

---

## See also

- [08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md) — suggested next steps
- [04-backend-architecture.md](./04-backend-architecture.md) — adapter extension points
- [07-environment-and-deployment.md](./07-environment-and-deployment.md) — production setup
