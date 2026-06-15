# Onboarding Checklist

Step-by-step first session for a new agent or developer.

---

## Phase 1: Read (30 minutes)

- [ ] [README.md](./README.md) — quick start and doc index
- [ ] [01-product-vision.md](./01-product-vision.md) — what AXIOM builds and why
- [ ] [08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md) — what's shipped vs in-flight
- [ ] [09-conventions-and-agent-rules.md](./09-conventions-and-agent-rules.md) — rules before coding

Optional deep dives based on your task:
- Frontend work → [03-frontend-architecture.md](./03-frontend-architecture.md)
- Backend work → [04-backend-architecture.md](./04-backend-architecture.md)
- UI work → [05-design-system.md](./05-design-system.md)

---

## Phase 2: Setup (15 minutes)

```powershell
cd c:\Users\Orcc_\OneDrive\Desktop\AXIOM\website
npm install
```

**First time only** — Property API Python env:

```powershell
cd services/property-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
crawl4ai-setup
python -m playwright install chromium
cd ../..
```

Copy env templates if not present:
- `.env.example` → `.env.local` (repo root)
- `services/property-api/.env.example` → `services/property-api/.env`

Add at minimum: `RENTCAST_API_KEY`, `ATTOM_API_KEY`, `MELISSA_LICENSE_KEY` (for Vendor comparison demo).

---

## Phase 3: Run (5 minutes)

```powershell
npm run dev:all
```

Confirm:
- [ ] Frontend at http://127.0.0.1:5173 loads
- [ ] Property API at http://127.0.0.1:8000/health returns OK

```powershell
npm run check:property-keys
```

- [ ] Vendor keys show as configured

---

## Phase 4: Smoke test Public Data Command (5 minutes)

1. Open http://127.0.0.1:5173/public-data-command
2. Confirm map loads with dark basemap
3. Toggle feed layers (USGS, NWS, FEMA, NASA) — status chips update
4. Switch scope: Global → National → Local
5. Click an earthquake marker — detail panel opens

If feeds fail: check browser console; dev proxies require network access.

---

## Phase 5: Smoke test Property Intelligence (15 minutes)

1. Open http://127.0.0.1:5173/property-intelligence
2. Dismiss intro modal if shown
3. Enter a full US address (e.g. `123 Main St, Portland, OR 97201`)
4. Lock map view (required before generate)
5. Under *More packages*, select **Vendor comparison**
6. Confirm live receipt shows line items and total
7. Click **Generate**
8. When complete, review tabs:
   - [ ] **COPE** — sections with field values
   - [ ] **Sources** — per-source raw fields
   - [ ] **Hazards** — FEMA, USGS, etc.
   - [ ] **Conflicts** — any multi-source disagreements
9. Click **Export COPE Excel** — file downloads
10. Click **Export COPE PDF** — PDF downloads (needs Playwright)
11. Click **View live hazards at this location** — opens PDC with lat/lng

If API offline: ensure `npm run dev:all` is running, not `npm run dev` alone.

---

## Phase 6: Understand your task (before coding)

- [ ] Run `git status` — check for uncommitted in-flight work ([08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md))
- [ ] Identify which product your task touches (PDC vs PI vs both)
- [ ] Read relevant flow diagram in [06-data-flows.md](./06-data-flows.md)
- [ ] Check [10-known-gaps-and-stubs.md](./10-known-gaps-and-stubs.md) — don't rebuild stubs thinking they're broken

---

## Phase 7: Agent-specific

- [ ] Read [09-conventions-and-agent-rules.md](./09-conventions-and-agent-rules.md) again
- [ ] For non-trivial features: use Superpowers brainstorming skill first
- [ ] Do not commit unless user explicitly asks
- [ ] Do not create docs unless user asks (except updating handoff state when major work completes)

---

## Quick reference

| Task | Command / path |
|------|----------------|
| Run everything | `npm run dev:all` |
| Check API keys | `npm run check:property-keys` |
| Billing smoke test | `npm run smoke:billing` |
| PI demo preset | Vendor comparison |
| Primary PI hook | `src/hooks/usePropertyReport.js` |
| Enrich endpoint | `POST /enrich` in `services/property-api/main.py` |
| Add data source | See [04-backend-architecture.md](./04-backend-architecture.md) |
| Design tokens | `tailwind.config.js` |

---

## See also

- [README.md](./README.md) — doc index
- [07-environment-and-deployment.md](./07-environment-and-deployment.md) — env vars and deploy
- [../../AGENTS.md](../../AGENTS.md) — Cursor agent entry
