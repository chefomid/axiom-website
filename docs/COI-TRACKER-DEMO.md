# COI Tracker Live Demo

Interactive COI Tracker demo linked from the marketing site. The demo is the full COI Tracker app (separate repo) with the `DEMONSTRATION/` kit applied: fictional portfolio data, read-only mode, auto-login, and a banner linking back to AXIOM.

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| Marketing site | Vercel (this repo) | `https://www.axiompropertycasualty.com` |
| Demo UI | Vercel (COI Tracker repo) | `https://demo-coi.axiompropertycasualty.com` |
| Demo API | Render (COI Tracker `infra/render.yaml`) | `https://coi-demo-api.onrender.com` |

The website links out to the demo. Do not embed the demo in an iframe.

## Website integration

### Feature gate

Live demo CTAs appear when:

- **Local dev:** always (defaults to `http://localhost:5180`)
- **Production:** only when `VITE_COI_TRACKER_DEMO_URL` is set on Vercel

Logic: `src/config/features.js` → `isCoiTrackerDemoEnabled()`

### CTAs

- **COI Tracker dossier modal** (`src/components/CoiTrackerModal.jsx`): primary button "Try the live demo"
- **Home page COI card** (`src/pages/Home.jsx`): secondary "Live demo" link (does not open the dossier modal)

### Vercel env (website project)

```env
VITE_COI_TRACKER_DEMO_URL=https://demo-coi.axiompropertycasualty.com
```

Redeploy after setting.

## COI Tracker repo

Source: sibling folder `../COI Tracker` with `DEMONSTRATION/` at repo root.

Key files:

| Path | Role |
|------|------|
| `DEMONSTRATION/` | Demo kit (seed, middleware, banner, scripts) |
| `vercel.json` | Demo frontend build (`demo:apply` + Vite). Use Vercel project **`coi-demo-ui`** (Vite, not Services). |
| `infra/render.yaml` | Demo API + Postgres on Render (Blueprint path: `infra/render.yaml`) |

See `DEMONSTRATION/INTEGRATION.md` in the COI Tracker repo for full kit documentation.

## Local smoke test

### 1. Start COI Tracker demo

From the COI Tracker repo root:

```powershell
npm run demo:apply
npm run demo:assets
docker compose -f DEMONSTRATION/docker-compose.demo.yml up -d

copy DEMONSTRATION\env\backend.env.example backend\.env
copy DEMONSTRATION\env\frontend.env.example .env.local

npm run setup --prefix backend
npm run demo:seed
npm run dev:all
```

Open http://localhost:5180. You should land on the dashboard with an amber **Interactive demo** banner and **← Back to AXIOM** link.

### 2. Start marketing site

From this repo root:

```powershell
npm run dev
```

Open http://localhost:5173, click **COI Tracker** on the home page, then **Try the live demo** (opens `:5180`).

## Production deployment

### Demo API (Render)

1. Connect the COI Tracker Git repo to Render.
2. **New → Blueprint** → set Blueprint path to **`infra/render.yaml`** (creates `coi-demo-api` + `coi_tracker_demo` Postgres).
3. After first deploy, run once (Render shell or local against prod DB):

   ```powershell
   npm run setup --prefix backend
   npm run demo:assets
   npm run demo:seed
   ```

4. Do **not** set `OPENAI_API_KEY`, `NYLAS_API_KEY`, or `RESEND_API_KEY` on the demo API.

5. Optional: nightly cron `npm run demo:reset` to restore seed data.

### Demo UI (Vercel project `coi-demo-ui`)

1. Create a **Vite** project (not Services). Do not run `vercel link` on a repo that also has `infra/render.yaml` at root without setting framework to `vite` first.
2. Custom domain: `demo-coi.axiompropertycasualty.com` (CNAME → Vercel).
3. Deploy via CLI as **chefomid** (`orcc_omid@outlook.com`). Do **not** use `omid.rezaee@oit.edu` / GitHub `omidrezaee1` for commits; Vercel blocks those deploys. Use:

   ```powershell
   vercel deploy --prod --scope chefomids-projects --archive=tgz
   ```
4. Build uses `vercel.json` (`npm run demo:apply && npm run build`).

| Variable | Value |
|----------|-------|
| `VITE_DEMO_MODE` | `true` |
| `VITE_API_BASE_URL` | `https://coi-demo-api.onrender.com` |
| `VITE_MARKETING_SITE_URL` | `https://www.axiompropertycasualty.com` |

### Marketing site (existing Vercel project)

Set `VITE_COI_TRACKER_DEMO_URL=https://demo-coi.axiompropertycasualty.com` and redeploy.

## Verification checklist

| Step | Expected |
|------|----------|
| Local COI demo | Dashboard loads, demo banner visible, auto-login |
| Website local | Modal + home card show live demo links |
| Demo banner | **← Back to AXIOM** → marketing site |
| Prod (before env) | Live demo CTAs hidden on marketing site |
| Prod (after env) | CTAs open `demo-coi.axiompropertycasualty.com` |
| Demo restrictions | Writes/AI/uploads blocked (403 + hidden UI) |

## Related docs

- [agent-handoff/01-product-vision.md](./agent-handoff/01-product-vision.md) — product map
- [PROPERTY-INTELLIGENCE.md](./PROPERTY-INTELLIGENCE.md) — similar two-host deploy pattern for PI
