# Property Intelligence API

Python service for property enrichment (Crawl4AI), geocoding, and **seismic report PDF generation** (Playwright).

## Setup

```powershell
cd services/property-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Optional property crawling (Crawl4AI — heavier deps):

```powershell
python -m pip install -r requirements-crawl4ai.txt
crawl4ai-setup
```

On Linux (Railway / Fly.io):

```bash
pip install -r requirements.txt
playwright install chromium --with-deps
```

## Run (local)

```powershell
# From repo root — frontend + API together
npm run dev:all

# Or API only
uvicorn main:app --reload --port 8000
```

Set `FRONTEND_URL=http://127.0.0.1:5173` so Playwright can load the print preview route (must match the Vite dev URL).

## Endpoints

### Property Intelligence

- `GET /health`
- `POST /enrich` — body: `{ "address": "...", "source_url": "https://..." }` (source_url optional)

### Seismic Report PDF

- `GET /reports/health`
- `POST /reports/sessions` — body: `{ "document": { ...ReportDocument } }` → `{ "sessionId": "..." }`
- `GET /reports/sessions/{sessionId}` — returns stored document for print preview
- `POST /reports/sessions/{sessionId}/pdf` — Playwright renders `{FRONTEND_URL}/reports/print/{sessionId}` → PDF bytes

Sessions expire after 15 minutes (`REPORT_SESSION_TTL_SECONDS`, default 900).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | `http://127.0.0.1:5173` | Vite dev server or production Vercel URL for print route |
| `REPORT_SESSION_TTL_SECONDS` | `900` | Session cache TTL |

## Frontend configuration

Local dev uses the Vite proxy: `/api/reports` → `http://127.0.0.1:8000/reports`.

Production (Vercel static site) must point at a deployed API:

```env
VITE_REPORT_API_URL=https://your-property-api.example.com/reports
```

If unset in production, the client falls back to `/api/reports` (requires a reverse proxy).

## Production deployment (Railway or Fly.io)

The Vercel frontend cannot run Playwright. Deploy this service separately.

### Railway

1. New project → deploy from repo, set **Root Directory** to `services/property-api`.
2. **Build command:** `pip install -r requirements.txt && playwright install chromium --with-deps`
3. **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Environment:
   - `FRONTEND_URL=https://www.axiompropertycasualty.com`
   - `PORT` (Railway sets automatically)
5. Copy the public URL into Vercel: `VITE_REPORT_API_URL=https://<service>.up.railway.app/reports`

### Fly.io

```bash
cd services/property-api
fly launch --no-deploy
```

Example `Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Set secrets:

```bash
fly secrets set FRONTEND_URL=https://www.axiompropertycasualty.com
```

### CORS

Production origins are allowed in `main.py`:

- `https://www.axiompropertycasualty.com`
- `https://axiompropertycasualty.com`

Add preview domains if needed.

## PDF flow

1. User clicks **Download PDF** in the seismic report viewer.
2. Frontend builds `ReportDocument`, validates it, `POST /reports/sessions`.
3. API stores JSON, returns `sessionId`.
4. API launches Chromium, opens `/reports/print/{sessionId}`, waits for `#report-print-ready`, exports Letter PDF.
5. Browser saves `seismic-report-{location}.pdf`.

Until the API is deployed, production downloads show: *Report PDF service unavailable.*

Respect Nominatim usage policy (low rate, attribution). Crawl only public pages allowed by their terms.
