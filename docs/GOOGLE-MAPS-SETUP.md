# Google Maps API key (Property Intelligence imagery)

Property Intelligence uses **two free imagery layers**:

| Layer | Provider | API key? |
|-------|----------|----------|
| Satellite preview | Esri World Imagery | **No** |
| Street View availability + embed | Google Maps Platform | **Yes** (`VITE_GOOGLE_MAPS_API_KEY`) |

You only need Google for the **Street** tab. Enable these SKUs (both have generous free tiers):

- **Street View Metadata** — unlimited free (checks if panoramas exist at the pin)
- **Maps Embed API** — unlimited free (interactive Street View iframe)

Do **not** enable **Street View Static API** unless you add custom features that need still images (we do not use it by default).

---

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with a Google account.
3. Top bar → **Select a project** → **New project**.
4. Name it (e.g. `AXIOM Property Intelligence`) → **Create**.
5. Select that project.

---

## 2. Enable billing

Google requires a billing account on the project even for free-tier APIs (you are not charged while usage stays within free caps).

1. **Billing** → link or create a billing account.
2. Attach it to your project.

---

## 3. Enable the APIs

1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library).
2. Search and enable:
   - **Maps Embed API**
   - **Street View Static API** is **not** required for the default UI (only Metadata + Embed).

For the metadata check, enable:

- Search **“Street View”** or open [Street View Static API](https://console.cloud.google.com/apis/library/street-view-image.googleapis.com) — the **Metadata** endpoint is part of the Street View product; enabling **Maps Embed API** is the main step. If metadata calls fail with `REQUEST_DENIED`, also enable **Maps JavaScript API** or ensure **Street View Static API** is enabled (metadata shares the same key; metadata calls are billed as **Street View Metadata** SKU, which is unlimited free).

Recommended minimum enabled APIs:

| API name | Why |
|----------|-----|
| **Maps Embed API** | Embedded Street View panorama |
| **Street View Static API** | Hosts the metadata endpoint (`/maps/api/streetview/metadata`) used for “is coverage available?” |

> Metadata requests are **free and unlimited** on the [official pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) under SKU **Street View Metadata**.

---

## 4. Create an API key

1. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials** → **API key**.
3. Copy the key (starts with `AIza…`).

### Restrict the key (recommended)

1. Click the key → **Edit**.
2. **Application restrictions** → **HTTP referrers (web sites)**.
3. Add referrers:

   ```
   http://localhost:*
   http://127.0.0.1:*
   https://your-production-domain.com/*
   ```

4. **API restrictions** → **Restrict key** → select only:
   - Maps Embed API
   - Street View Static API *(for metadata only)*

5. **Save**.

---

## 5. Add the key to AXIOM

In the **repo root** (same folder as `package.json`), create or edit `.env.local`:

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_key_here
```

Restart the dev server after changing env files:

```powershell
# Stop npm run dev / dev:all, then:
npm run dev
# or
npm run dev:all
```

Vite only reads `VITE_*` variables at startup.

---

## 6. Verify in the app

1. Open [http://localhost:5173/property-intelligence](http://localhost:5173/property-intelligence) (or your dev port).
2. Enter a US address and confirm the map pin (e.g. `123 Main St, Portland, OR 97201`).
3. **Satellite** tab — should load Esri imagery with **no** Google key.
4. **Street** tab — should show “Checking coverage…”, then either:
   - Embedded Street View if Google has coverage, or
   - “No Street View coverage” with links to Google Maps / Mapillary.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Street tab says “Add VITE_GOOGLE_MAPS_API_KEY” | Key missing or dev server not restarted after `.env.local` change |
| `REQUEST_DENIED` in browser network tab | Enable Maps Embed + Street View Static APIs; check API restrictions include those APIs |
| Referrer blocked | Add your exact dev URL to HTTP referrer list (`http://localhost:5173/*`) |
| Satellite blank | Esri outage or ad blocker; try “Open in Google Maps” link |
| Billing surprise | In Cloud Console → **APIs & Services → Dashboard**, set **Quotas** alerts; avoid enabling unused Maps SKUs |

---

## Cost summary (typical AXIOM usage)

- **Esri satellite export** — no Google charges.
- **Street View Metadata** — unlimited free.
- **Maps Embed (Street View)** — unlimited free.
- **Street View Static** (image URLs) — **not used** in the default app.

Official pricing: [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing).
