# Frontend Architecture

React 18 + Vite 5 frontend. No TypeScript, no global state library, no component library.

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build | Vite 5 (ESM, `type: "module"`) |
| Routing | React Router v6 (`createBrowserRouter`) |
| Maps | MapLibre GL v5 |
| Styling | Tailwind CSS 3 + global CSS (`index.css`) |
| Animations | Framer Motion (Home page, some panels) |
| Charts | Recharts (earthquake analytics) |
| Excel export | exceljs (COPE report, client-side) |

---

## Routes

Defined in `src/constants/routes.js`, wired in `src/App.jsx`:

| Path | Page | View component |
|------|------|----------------|
| `/` | `pages/Home.jsx` | Inline (marketing) |
| `/public-data-command` | `pages/PublicDataCommand.jsx` | `components/better-world/PublicDataCommandView.jsx` |
| `/property-intelligence` | `pages/PropertyIntelligence.jsx` | Lazy `components/property-intelligence/PropertyIntelligenceView.jsx` |
| `/reports/print/:sessionId` | `pages/ReportPrint.jsx` | `components/report-print/*` |
| `/impact-map` | Redirect → `/public-data-command` | Legacy |
| `/a-better-world` | Redirect → `/` | Legacy |

Deep-link helper: `publicDataCommandAtLocation(lat, lng)` → `/public-data-command?lat=&lng=&scope=local`

---

## Page → View pattern

Thin page wrappers handle document title, feature flags, and lazy loading. Heavy UI lives in `*View.jsx` components.

```
PropertyIntelligence.jsx
  └─ isPropertyIntelligenceEnabled() ?
       ├─ false → PropertyIntelligenceComingSoon
       └─ true  → Suspense → PropertyIntelligenceView.jsx (lazy via lazyWithRetry)

PublicDataCommand.jsx
  └─ TelemetryProvider → PublicDataCommandView.jsx
```

---

## Feature flags

`src/config/features.js`:

```javascript
export function isPropertyIntelligenceEnabled() {
  if (import.meta.env.DEV) return true
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_PROPERTY_INTELLIGENCE_ENABLED === 'true'
  }
  return false
}
```

- **Dev:** PI always enabled.
- **Production:** Coming Soon page unless `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` on Vercel.

---

## Property Intelligence architecture

### Main orchestrator

`PropertyIntelligenceView.jsx` — full-viewport map-first layout:

| Area | Width | Contents |
|------|-------|----------|
| Map | flex | PropertyMap + PropertyWorkflowHud (setup, sources, estimate, generate) |
| Report panel | 440–480px (when open) | ReportResultsPanel slide-over on the right |

**State managed locally:**
- Address draft vs committed address, geocoding
- Map view lock (required before generate)
- Source URL map for crawl sources
- Billing notices, intro modal acknowledgment
- URL search params for deep links

### Primary hook: `usePropertyReport`

`src/hooks/usePropertyReport.js` — **the single source of truth** for PI workflow:

| Responsibility | Detail |
|----------------|--------|
| Catalog | Loads from `GET /catalog`; restores from `sessionStorage` key `axiom:property-intelligence:report-state` |
| Source selection | Preset apply, à la carte toggles, skip notices for missing keys |
| Quote | Debounced (250ms) via `scheduleQuote` → `POST /quote` |
| Enrich | `runReport` → `POST /enrich` with confirmed price + anon ID |
| Errors | Handles 402 payment-required from billing gate |

**Legacy:** `usePropertyEnrichment.js` is superseded — do not extend it.

### API client: `propertyApi.js`

`src/services/propertyApi.js` — all Property API calls:

| Function | Endpoint |
|----------|----------|
| `fetchCatalog` | `GET /catalog` |
| `quoteProperty` | `POST /quote` |
| `enrichProperty` | `POST /enrich` |
| `discoverSourceUrls` | `POST /discover-source-urls` |
| `fetchBillingPacks` | `GET /billing/packs` |
| `fetchBillingBalance` | `GET /billing/balance` |
| `createCheckoutSession` | `POST /billing/checkout` |
| `checkPropertyApiHealth` | `GET /health` |

**URL resolution:**
- Dev: `/api/property/*` → Vite proxy → `127.0.0.1:8000`
- Prod: `VITE_PROPERTY_API_URL` or fallback `/api/property`

### Component inventory

All under `src/components/property-intelligence/`:

| Component | Role |
|-----------|------|
| `PropertyIntelligenceView.jsx` | Main shell |
| `PropertySearchBar.jsx` | Address input + autocomplete |
| `PropertyMap.jsx` | MapLibre + satellite/Street View |
| `PropertyHeader.jsx` | Nav + credits wallet |
| `PropertyWorkflowHud.jsx` | Map-anchored workflow (setup, sources, estimate, generate) |
| `MapAnchoredPanel.jsx` | Reusable setup/docked/anchored panel shell |
| `IntentPackagePicker.jsx` | Preset packages + add-ons |
| `WorkflowEstimate.jsx` / `WorkflowGenerateButton.jsx` | HUD banner pricing + CTA |
| `LiveReceipt.jsx` | Standalone receipt (legacy shell; HUD uses workflow components) |
| `SourceCatalog.jsx` | À la carte source picker |
| `ReportResultsPanel.jsx` | Tabbed results: COPE / Sources / Hazards / Conflicts |
| `CopeSnapshot.jsx` | COPE summary display |
| `ReportSourceFields.jsx` | Per-source field breakdown |
| `ReportHazardsPanel.jsx` | Hazard payloads |
| `ReportConflictsPanel.jsx` | Multi-source conflicts |
| `PublicSourcePanel.jsx` | Manual public record URL entry |
| `SourceCatalogPanel.jsx` | Filtered source list (HUD sources dropdown) |
| `SidebarSection.jsx` | Reusable section wrapper (unused in PI shell) |
| `CreditsWallet.jsx` | Stripe credit pack purchase |
| `VendorKeysStatus.jsx` | API key configuration status |
| `PropertyIntelligenceIntroModal.jsx` | First-visit disclaimer (localStorage) |

### Export utilities

| File | Role |
|------|------|
| `src/utils/copeReportDocument.js` | Build/validate PDF document schema → `POST /reports/sessions` |
| `src/utils/copeReportExcel.js` | Excel export via exceljs (browser-only, no server) |

---

## Public Data Command architecture

### Main orchestrator

`PublicDataCommandView.jsx` wrapped in `TelemetryProvider`:

```
PublicDataCommandView.jsx
  ├── CommandHeader + FeedStatusBar
  ├── CommandMap.jsx (MapLibre, ~1,400+ lines)
  ├── IntelligencePanel (live signals)
  ├── DataSourcePanel + MapControlsDock
  ├── TelemetryFeed
  └── Modals (intro, scope setup, earthquake analysis, report builder)
```

### Feed pipeline

```
services/*.js (USGS, NWS, FIRMS, NFHL)
        ↓
hooks/use*.js (cache, retry, telemetry)
        ↓
utils/riskCache.js (TTL + sessionStorage)
        ↓
utils/riskNormalize.js → RiskEvent schema
        ↓
CommandMap.jsx (GeoJSON layers)
```

Feed config: `src/data/commandMapData.js`

Scope modes: **global**, **national**, **local** (radius around user).

### Shared with Property Intelligence

- `AddressGeocodeInput.jsx` — geocode autocomplete
- `maplibre.js` — MapLibre import
- MapLibre instances are separate (different styles, no shared state)

---

## Error handling

| Pattern | Where |
|---------|-------|
| App-wide boundary | `AppErrorBoundary.jsx` |
| Route-level fallback | `RouteErrorFallback.jsx` (PI chunk load errors) |
| Lazy load retry | `lazyWithRetry.js` — survives Vite HMR restarts |
| Feed retry | `useFeedRetry.js` — stale fallback + scheduled retry |
| Billing 402 | Structured error in `usePropertyReport` |

---

## State management

**No Redux, Zustand, or Jotai.**

| Scope | Mechanism |
|-------|-----------|
| Component state | `useState`, `useReducer` |
| PI report persistence | `sessionStorage` (`axiom:property-intelligence:report-state`) |
| PDC telemetry | `TelemetryContext` |
| Billing anon ID | `localStorage` via `src/utils/anonId.js` |
| Feed cache | `riskCache.js` (memory + sessionStorage for USGS) |

---

## Legacy / cleanup candidates

| File | Issue |
|------|-------|
| `src/pages/BetterWorld.jsx` | Not in router; `/a-better-world` redirects to `/` |
| `src/hooks/usePropertyEnrichment.js` | Superseded by `usePropertyReport` |
| `src/components/better-world/` folder name | Product renamed to "Public Data Command" |

---

## See also

- [05-design-system.md](./05-design-system.md) — UI conventions
- [06-data-flows.md](./06-data-flows.md) — end-to-end flows
- [../PUBLIC-DATA-COMMAND-ARCHITECTURE.md](../PUBLIC-DATA-COMMAND-ARCHITECTURE.md) — PDC feed details
- [../PROPERTY-INTELLIGENCE.md](../PROPERTY-INTELLIGENCE.md) — PI demo checklist
