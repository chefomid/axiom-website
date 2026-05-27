# Public Data Command — Technical Architecture

Internal engineering handoff for the AXIOM Public Data Command center (`/public-data-command`).

## Product summary

Public Data Command visualizes **live government open-data risk feeds** on a dark command-center interface. There are **no client portfolios or SOV uploads** in this product — only public events, warnings, and hazard zones scoped by the user’s operational view (global / national / local).

## Live data sources

| Source | Layer | Geometry | Refresh |
|--------|-------|----------|---------|
| USGS FDSNWS | earthquake | Points | 5 min |
| NWS api.weather.gov | weather | Polygons | 3 min |
| NASA FIRMS | wildfire | Points | 15 min |
| FEMA NFHL | flood | Polygons + raster overlay | 24 h |
| EPA AirNow | environment | Points | 30 min |

API keys (optional — feeds work without them):

| Key | Without key | With key |
|-----|-------------|----------|
| `VITE_NASA_FIRMS_MAP_KEY` | NASA EONET open wildfire events | NASA FIRMS VIIRS hotspots |
| `VITE_AIRNOW_API_KEY` | Open-Meteo US AQI grid | EPA AirNow station observations |

## Stack

| Layer | Technology |
|-------|------------|
| App | React 18 + Vite |
| Routing | React Router (`/public-data-command`; `/impact-map` redirects) |
| Map | MapLibre GL v5 |
| Basemap | Carto Dark Matter GL |
| Styling | Tailwind CSS |

## Architecture

```
PublicDataCommand.jsx
  └── TelemetryProvider
        └── PublicDataCommandView.jsx
              ├── CommandHeader + FeedStatusBar
              ├── CommandMap.jsx (MapLibre)
              ├── IntelligencePanel
              └── TelemetryFeed
```

## Data pipeline

```
services/ (USGS, NWS, FIRMS, NFHL, AirNow)
        ↓
RiskEvent normalization (riskNormalize.js)
        ↓
hooks (useUsgs*, useNws*, useNasaFirms, useFemaNfhl, useAirNow)
        ↓
riskCache.js (TTL memory + sessionStorage for USGS)
        ↓
filterMarkers / filterZones
        ↓
CommandMap
  ├── risk-events (individual points, zoom-scaled)
  ├── risk-zones (fill + line)
  └── nfhl-raster (image overlay when flood layer on)
```

## RiskEvent schema

See `src/types/riskEvent.js` and `src/utils/riskNormalize.js`.

- **Points** → `toRiskPoint()` → marker objects for clustering
- **Polygons** → `toRiskZone()` → GeoJSON zones + selectable zone markers (centroid)

## Map layers

| Source ID | Type | Layers |
|-----------|------|--------|
| `risk-events` | GeoJSON points | risk-points (no clustering) |
| `risk-zones` | GeoJSON polygons | risk-zones-fill, risk-zones-line |
| `nfhl-raster` | Image | nfhl-raster-layer (FEMA export URL) |
| `scope-radius` | GeoJSON polygon | local scope ring |

## Dev proxy (CORS)

`vite.config.js` proxies:

- `/api/nws` → api.weather.gov
- `/api/fema` → hazards.fema.gov
- `/api/firms` → firms.modaps.eosdis.nasa.gov
- `/api/airnow` → airnowapi.org

**Production** requires an equivalent reverse proxy with NWS `User-Agent` header.

## Scope behavior

- **Global:** CONUS bbox for most feeds; USGS worldwide
- **National:** Country bbox (USGS) or country filter
- **Local:** Radius around geolocated user; NWS alerts can flag “inside warning” in detail text

## Files

| Path | Role |
|------|------|
| `src/services/usgsEarthquakes.js` | USGS fetch |
| `src/services/nwsAlerts.js` | NWS active alerts |
| `src/services/nasaFirms.js` | FIRMS hotspots |
| `src/services/femaNfhl.js` | NFHL vector + raster URLs |
| `src/services/airNow.js` | AirNow lat/lng grid |
| `src/hooks/use*.js` | Feed hooks + telemetry |
| `src/utils/riskCache.js` | TTL cache |
| `src/utils/scopeBbox.js` | Bbox from scope |
| `src/components/better-world/PublicDataCommandView.jsx` | Orchestrator |

## Known limitations

- FEMA NFHL vector queries capped at 500 features per bbox
- NWS national fetch capped at 500 alerts; bbox-filtered client-side
- AirNow uses a coarse lat/lng grid (API rate limits)
- FIRMS / AirNow disabled without env keys (telemetry warns)
- NFHL raster is a single image per scope bbox, not XYZ tiles
