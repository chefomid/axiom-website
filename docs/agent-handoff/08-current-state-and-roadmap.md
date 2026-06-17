# Current State and Roadmap

Snapshot as of **2026-06-07**. Check `git status` for latest uncommitted work.

---

## Production-ready

| Area | Route / component | Notes |
|------|-------------------|-------|
| Home | `/` | Marketing landing, COI/Insurance Manager modals |
| Public Data Command | `/public-data-command` | Full map, multi-feed, scope modes, earthquake analysis, PDF reports |
| Report print | `/reports/print/:sessionId` | Playwright PDF pipeline |
| Property API health | `GET /health` | Deployed on Render as `axiom-report-api` |

---

## Active development: Property Intelligence

Feature-flagged in production. **Fully functional in local dev** with `npm run dev:all`.

| Capability | Status |
|------------|--------|
| Address geocode + map lock | Working |
| Preset packages + à la carte sources | Working |
| Live quote (debounced) | Working |
| Enrich → COPE report | Working |
| Report tabs (COPE, Sources, Hazards, Conflicts) | Working |
| Export COPE PDF (Playwright) | Working |
| Export COPE Excel (client-side) | Working |
| Find with AI (URL discovery) | Working (needs OPENAI_API_KEY) |
| Web property research add-on | Working (needs OPENAI_API_KEY) |
| Stripe billing / credits | Working (optional locally) |
| Deep link to Public Data Command | Working |
| Production launch | **Not yet** — Coming Soon gate active |

---

## In-flight work (uncommitted as of handoff date)

The following changes were in progress when this handoff was written. **Not yet committed to git.** Review `git status` and `git diff` before assuming main branch state.

### Backend

| Area | Files | What changed |
|------|-------|--------------|
| Hazard adapter refactor | `adapters/hazard_fetch.py`, `adapters/hazards/*.py`, deleted `hazards.py` | Split monolithic hazards into HTTP helpers + thin adapters |
| OSINT updates | `adapters/osint/*.py`, `adapters/osint.py` | OSM footprint and protection GIS improvements |
| Web property research | `adapters/services/web_property_research.py`, `registry/mappings/web_property_research.yaml` | New OpenAI web search source for COPE fields |
| Source discovery | `source_discovery/discover.py`, `jurisdiction.py`, `resolve.py`, `url_validate.py` | AI + jurisdiction URL resolution |
| Vendor adapters | `attom.py`, `melissa.py`, `rentcast.py` | Mapping and normalization updates |
| COPE merger | `merger/cope.py`, `planner/quote.py` | Snapshot building and quoting improvements |
| Registry | `registry/sources.json`, `presets.json`, mapping YAMLs | New sources and preset updates |
| Engine | `engine/registry.py` | New adapter registrations |
| LLM | `llm/openai_client.py` | Web search client updates |
| Reports | `report_html.py`, `report_pdf.py` | COPE dossier rendering |

### Frontend

| Area | Files | What changed |
|------|-------|--------------|
| PI main view | `PropertyIntelligenceView.jsx` | Sidebar refactor, workflow orchestration |
| Report panels | `ReportResultsPanel.jsx`, `ReportHazardsPanel.jsx`, `ReportConflictsPanel.jsx`, `ReportSourceFields.jsx` | New tabbed results UI |
| Export | `copeReportDocument.js`, `copeReportExcel.js` | Client-side COPE PDF schema + Excel export |
| Package picker | `IntentPackagePicker.jsx` | Web research toggle, preset updates |
| Map + search | `PropertyMap.jsx`, `PropertySearchBar.jsx`, `AddressGeocodeInput.jsx` | Map lock, geocoding improvements |
| Advanced | `AdvancedDrawer.jsx`, `SourceCatalog.jsx`, `PublicSourcePanel.jsx` | Source catalog and URL entry |
| UX | `PropertyIntelligenceIntroModal.jsx`, `SidebarSection.jsx`, `LiveReceipt.jsx` | Intro modal, sidebar sections |
| Routing | `App.jsx`, `RouteErrorFallback.jsx`, `lazyWithRetry.js` | Error boundary, chunk retry |
| Cross-feature | `PublicDataCommandView.jsx`, `CommandMap.jsx`, `DataSourcePanel.jsx`, `MapControlsDock.jsx` | Deep link support, panel updates |
| Services | `propertyApi.js`, `reportApi.js`, `geocode.js`, `usePropertyReport.js` | API client and hook updates |
| Styling | `index.css`, agency SVG logos | UI polish |

### Docs

| File | What changed |
|------|--------------|
| `docs/PROPERTY-INTELLIGENCE.md` | Updated presets, export, web research docs |

---

## Suggested next steps

These are **inferred priorities**, not confirmed by the product owner. Validate with the user before treating as requirements.

### Immediate

1. **Review and commit in-flight PI work** — large uncommitted diff across frontend and backend
2. **Smoke test Property dossier preset** on 2–3 US addresses with configured keys
3. **Verify PDF + Excel export** after any merger changes

### Launch

4. Enable `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` on Vercel
5. Configure Stripe production keys on Render
6. Run `npm run smoke:billing` against staging API
7. Mobile Checkout QA per BILLING-SETUP checklist

### Technical debt

8. Finish stub sources: `county_parcel_arcgis`, `openaddresses_lookup`
9. Enable CoreLogic adapters in catalog when keys available
10. Swap in-memory caches for Redis in production (`engine/cache.py`, `source_discovery/cache.py`)
11. Rename `components/better-world/` → `public-data-command/` (folder name mismatch)
12. Remove legacy `BetterWorld.jsx` and `usePropertyEnrichment.js`
13. Add frontend tests (none exist today)

### Feature ideas (unconfirmed)

14. County parcel auto-discovery adapter
15. `llm_extract` — LLM extraction from crawl HTML (currently stub)
16. CoreLogic/Cotality as insurance-grade alternative to ATTOM

---

## Demo checklist (local)

From [../PROPERTY-INTELLIGENCE.md](../PROPERTY-INTELLIGENCE.md):

1. `npm run check:property-keys`
2. Open `/property-intelligence` → **Property dossier** (or **Publicly available**)
3. Enter full US address → confirm live quote → **Generate**
4. Review tabs: COPE, Sources, Hazards, Conflicts
5. **Export COPE PDF** (needs Playwright: `python -m playwright install chromium`)
6. **Export COPE Excel** (browser-only)
7. Click **View live hazards** → confirms PDC deep link

---

## See also

- [01-product-vision.md](./01-product-vision.md) — product objectives
- [10-known-gaps-and-stubs.md](./10-known-gaps-and-stubs.md) — incomplete work
- [11-onboarding-checklist.md](./11-onboarding-checklist.md) — first session steps
- [../PROPERTY-INTELLIGENCE.md](../PROPERTY-INTELLIGENCE.md) — launch checklist
