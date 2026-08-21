# Fire Alerts Live Demo

Fire & Hotspots preview hosted on Vercel. Linked from the marketing site nav under **Public Data Command**. Email alerts and outbound reports are blocked in preview mode.

## Architecture

| Component | Host | URL |
|-----------|------|-----|
| Marketing site | Vercel (`axiom-website`) | `https://www.axiompropertycasualty.com` |
| Demo UI | Vercel (`fire-alerts-demo`) | `https://demo-fire.axiompropertycasualty.com` (pending DNS). Fallback: `https://fire-alerts-demo.vercel.app` |

Do not embed the demo in an iframe.

## Website integration

### Nav

`src/components/Nav.jsx`: **Public Data Command** opens a dropdown with:

- **Fire & Hotspots** → external demo URL (preview notice modal on first visit)
- **Seismic/EQ Analysis** → `/earthquake-analysis`

### Feature gate

Fire link appears when:

- **Local dev:** always (defaults to `http://localhost:5181`)
- **Production:** only when `VITE_FIRE_ALERTS_DEMO_URL` is set on Vercel

Logic: `src/config/features.js` → `isFireAlertsDemoEnabled()`

### Vercel env (website project)

```env
VITE_FIRE_ALERTS_DEMO_URL=https://fire-alerts-demo.vercel.app
```

Use `https://demo-fire.axiompropertycasualty.com` once DNS is live. Redeploy after setting.

## Hosted demo

Project: `chefomids-projects/fire-alerts-demo`

Share this URL once DNS is live:

`https://demo-fire.axiompropertycasualty.com`

Until the DNS record is added, use `https://fire-alerts-demo.vercel.app`.

Same pattern as COI Tracker (`demo-coi.axiompropertycasualty.com`). This is a subdomain, not a path on the marketing site. A path like `/fire-alerts` would collide with the marketing site's `/assets` and `/api/firms` routes.

DNS (Google Domains / Cloud DNS), same style as `demo-coi`:

- **A** `demo-fire.axiompropertycasualty.com` → `76.76.21.21`

Or a CNAME to Vercel, matching `demo-coi` (`demo-coi` currently CNAMEs to `*.vercel-dns-016.com`).

Deploy from `../Fire Alerts` as `chefomid`:

```powershell
vercel deploy --prod --scope chefomids-projects --archive=tgz --yes
```

The production build uses `--mode demo` (`VITE_DEMO_MODE=true`). NASA FIRMS, Census, and InciWeb go through same-origin `/api` proxies.

After uploading a schedule, **Set alerts** opens a popup explaining alerts are available through AXIOM's risk management platform, not on the web preview.

## Local demo

From `../Fire Alerts`:

```powershell
npm install
npm run demo
```

Open http://localhost:5181.

## Demo restrictions

| Action | Demo behavior |
|--------|----------------|
| Pin locations, map, live feeds, wind | Allowed |
| Upload schedule | Allowed |
| Set alerts / email rules / outbox | Popup: alerts not available on web preview. No reports written. |
