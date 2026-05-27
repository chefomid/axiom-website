# Assembly instructions (for downstream AI or designer)

## What this folder is

A **ready-to-assemble marketing deck kit** for **AXIOM Insurance Manager**. Another agent should produce a PDF, PowerPoint, one-pager, or web landing page using:

| File | Purpose |
|------|---------|
| `MANIFEST.json` | Slide order, headlines, bullets, image paths, status flags |
| `CONTENT.md` | Full narrative copy (cover, slides, closing) |
| `screenshots/*.png` | Renamed product screenshots (4 available) |
| `screenshots/*.SPEC.md` | Visual specs for slides that need re-export |

## Image status

- **available** — PNG present; use as-is.
- **available_partial** — PNG present but may lack full chrome (e.g. sidebar); acceptable or re-capture.
- **spec_only_re_export_needed** — No PNG; read the `.SPEC.md` and either re-screenshot the app or request assets from the user.

Original user screenshots saved by Cursor were **no longer on disk** at package build time. Four substitute captures from the same app session were included where they matched; six slides need re-export per spec.

## Recommended deliverable formats

1. **10-slide sales deck** (16:9) — use `deck_order` in `MANIFEST.json`
2. **One-pager** — cover tagline + 3 columns: Portfolio | Broker Connect | Mailman
3. **30-second script** — one `speaker_note` per slide, concatenated

## Design constraints

- Professional, minimal; match app (dark sidebar #111, white workspace, LOB color chips)
- No “AI magic” stock art — product screenshots are the hero
- Lead with **speed, communication, trust** — not model names

## Re-export checklist (for missing PNGs)

| File to create | App navigation |
|----------------|----------------|
| `02-portfolio-overview-manual-import.png` | Portfolio Overview → MODE: Manual → show 3-step sidebar |
| `03-exposures-gl-locations.png` | Portfolio → Exposures by Coverage → GL → Locations |
| `04-exposures-auto-nhtsa-vin-check.png` | Exposures → Auto → Vehicles → NHTSA VIN Check visible |
| `05-exposures-workers-comp-class-codes.png` | Exposures → WC → Class Codes + grand total |
| `08-broker-connect-stack-changes-modal.png` | Broker Connect → Endorse → Continue with endorsement modal |
| `09-broker-connect-confirm-and-send.png` | Confirm endorsement modal → Confirm & send email |
| `10-mailman-inbox-powered-by-nylas.png` | Mailman → Inbox with COI thread + POWERED BY NYLAS header |

Drop completed PNGs beside the `.SPEC.md` files (same basename, `.png` extension) and set `image_status` to `available` in `MANIFEST.json`.
