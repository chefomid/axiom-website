# Property Intelligence API

Python service using [Crawl4AI](https://github.com/unclecode/crawl4ai) for optional public-page extraction.

## Setup

```powershell
cd services/property-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
crawl4ai-setup
```

## Run

```powershell
uvicorn main:app --reload --port 8000
```

Endpoints:

- `GET /health`
- `POST /enrich` — body: `{ "address": "...", "source_url": "https://..." }` (source_url optional)

Respect Nominatim usage policy (low rate, attribution). Crawl only public pages allowed by their terms.
