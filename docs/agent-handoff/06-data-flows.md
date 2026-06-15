# Data Flows

End-to-end pipelines with diagrams. Use these to trace behavior before changing code.

---

## 1. Property Intelligence user flow

```mermaid
flowchart TD
    A[Enter US address] --> B[Geocode via Census/Photon]
    B --> C[Lock map view]
    C --> D[Select preset or sources]
    D --> E[Live quote debounced 250ms]
    E --> F{Need crawl URLs?}
    F -->|Yes| G[Manual entry or Find with AI]
    F -->|No| H[Generate]
    G --> H
    H --> I[POST /enrich]
    I --> J[Report tabs: COPE Sources Hazards Conflicts]
    J --> K[Export COPE PDF or Excel]
    J --> L[View live hazards at location]
    L --> M[Public Data Command deep link]
```

**Key files:**
- Frontend: `PropertyIntelligenceView.jsx`, `usePropertyReport.js`, `propertyApi.js`
- Backend: `main.py` `POST /enrich`

---

## 2. Enrich API pipeline (backend)

```mermaid
flowchart TD
    A[POST /enrich] --> B[geocode_address]
    B --> C[build_quote]
    C --> D[require_and_spend credits]
    D --> E[merge_source_urls]
    E --> F[auto_resolve_crawl_urls]
    F --> G[run_report engine.executor]
    G --> H[Parallel source fetch by stage]
    H --> I[Merge fields and hazards]
    I --> J[build_final_receipt]
    J --> K{cope_map selected?}
    K -->|yes| L[collect_observations]
    L --> M[resolve_all conflicts]
    M --> N[build_cope_snapshot]
    K -->|no| O[EnrichResponse]
    N --> O
```

**Execution stages:** Sources whose `depends_on` are satisfied run in parallel within each stage. Example: `attom_hazard` waits for `attom_property`.

**Post-process stubs:** `cope_map`, `pdf_dossier`, `llm_extract` return synthetic success; real COPE work happens in step N above.

**Key files:** `main.py`, `engine/executor.py`, `merger/trust.py`, `merger/cope.py`

---

## 3. Public Data Command feed pipeline

```mermaid
flowchart TD
    A[External APIs] --> B[services layer]
    B --> C[useUsgsEarthquakes useNwsAlerts etc]
    C --> D[riskCache.js TTL memory]
    D --> E[riskNormalize.js RiskEvent schema]
    E --> F[filterMarkers filterZones]
    F --> G[CommandMap.jsx GeoJSON layers]
```

**Feed sources:**

| Service | Hook | Refresh |
|---------|------|---------|
| USGS FDSNWS | `useUsgsEarthquakes` | 5 min |
| NWS api.weather.gov | `useNwsAlerts` | 3 min |
| NASA FIRMS/EONET | `useNasaFirms` | 15 min |
| FEMA NFHL | `useFemaNfhl` | 24 h |

**Dev proxy:** Vite proxies `/api/nws`, `/api/fema`, `/api/firms` to external APIs (see [07-environment-and-deployment.md](./07-environment-and-deployment.md)).

**Key files:** `src/data/commandMapData.js`, `src/services/*.js`, `src/hooks/use*.js`, `CommandMap.jsx`

---

## 4. Billing flow

```mermaid
flowchart TD
    A[User clicks Credits] --> B[GET /billing/packs]
    B --> C[POST /billing/checkout]
    C --> D[Stripe Checkout redirect]
    D --> E[User pays]
    E --> F[Stripe webhook POST /billing/stripe-webhook]
    F --> G[Credit wallet top-up]
    G --> H[User returns with billing=success]
    H --> I[Find with AI or Generate]
    I --> J[require_and_spend]
    J --> K{Sufficient credits?}
    K -->|yes| L[Run discovery or enrich]
    K -->|no| M[HTTP 402 Payment Required]
```

**When billing disabled:** `STRIPE_SECRET_KEY` unset → dry-run receipts, no charges, Credits wallet hidden in UI.

**Credit conversion:** ~10 credits per $1 of estimated report price (`billing/credits.py`).

**Key files:** `billing/gate.py`, `billing/stripe_service.py`, `CreditsWallet.jsx`

---

## 5. Source URL discovery

```mermaid
flowchart TD
    A[Crawl sources selected] --> B{User provided URL?}
    B -->|yes| C[Use user URL]
    B -->|no| D[Find with AI POST /discover-source-urls]
    D --> E[OpenAI web search]
    E --> F[url_validate reachability]
    F --> G[Return suggested URLs]
    G --> H[User confirms or edits]
    H --> I[Generate enrich]
    I --> J[auto_resolve_crawl_urls]
    J --> K{Still missing?}
    K -->|yes| L[jurisdiction table fallback]
    K -->|no| M[Crawl4AI fetch]
    L --> M
    C --> M
```

**Two discovery paths:**
1. **Explicit:** User clicks "Find with AI" before generate → `POST /discover-source-urls` (may charge credits)
2. **Automatic:** During enrich → `auto_resolve_crawl_urls()` fills gaps

**Distinct from web property research:** URL discovery finds assessor/permit portal pages for Crawl4AI. Web property research enriches COPE fields directly via OpenAI.

**Key files:** `source_discovery/discover.py`, `resolve.py`, `jurisdiction.py`, `MapSourceDiscoveryHud.jsx`

---

## 6. COPE PDF export

```mermaid
flowchart TD
    A[Report generated] --> B[User clicks Export COPE PDF]
    B --> C[copeReportDocument.js builds JSON schema]
    C --> D[POST /reports/sessions]
    D --> E[Session stored 15 min TTL]
    E --> F[GET /reports/sessions/id/pdf]
    F --> G[Playwright renders HTML to PDF]
    G --> H[PDF download]
```

**Excel export:** Entirely client-side via `copeReportExcel.js` + exceljs — no server dependency.

**Key files:** `copeReportDocument.js`, `report_pdf.py`, `report_html.py`

---

## 7. Earthquake report PDF (Public Data Command)

Separate from COPE PDF:

```mermaid
flowchart TD
    A[User selects earthquakes] --> B[EarthquakeReportBuilderModal]
    B --> C[reportApi.js createSession]
    C --> D[POST /reports/sessions]
    D --> E[/reports/print/sessionId Playwright]
    E --> F[PDF download]
```

Uses same report session infrastructure as COPE PDF but different document schema.

---

## See also

- [03-frontend-architecture.md](./03-frontend-architecture.md) — frontend entry points
- [04-backend-architecture.md](./04-backend-architecture.md) — backend entry points
- [../PUBLIC-DATA-COMMAND-ARCHITECTURE.md](../PUBLIC-DATA-COMMAND-ARCHITECTURE.md) — RiskEvent schema
