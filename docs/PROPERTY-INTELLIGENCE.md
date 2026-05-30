# Property Intelligence

Separate product tab from **Public Data Command**: address-centric enrichment instead of live hazard feeds.

## Route

`/property-intelligence`

## Stack

| Layer | Technology |
|-------|------------|
| UI | React + MapLibre (property pin map) |
| API | FastAPI + [Crawl4AI](https://github.com/unclecode/crawl4ai) |
| Geocoding | OpenStreetMap Nominatim (dev/prototype) |

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

## Deep link to hazards

After enrichment, **View live hazards at this location** opens Public Data Command with `?lat=&lng=&scope=local`.

## Production

Set `VITE_PROPERTY_API_URL` to your deployed API origin, or reverse-proxy `/api/property` like other AXIOM API routes.
