# Design System

Dark command-center aesthetic shared across Public Data Command and Property Intelligence.

---

## Visual language

- **Background:** `#080808` (Tailwind `bg-black`)
- **Feel:** Military/ops command center — dark panels, mono labels, status color coding
- **Density:** Information-dense sidebars; map dominates the viewport
- **Motion:** Subtle — scanline effects on map, Framer Motion on Home page only

---

## Typography

Loaded via Google Fonts in `index.html`:

| Token | Font | Usage |
|-------|------|-------|
| `font-sans` | Inter | Body text, descriptions |
| `font-display` | Space Grotesk | Headings, product titles |
| `font-mono` | IBM Plex Mono | Labels, status chips, data values, receipts |

**Label pattern** (used everywhere):

```jsx
<span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
  Section label
</span>
```

Sizes: `text-[9px]` to `text-[11px]` for mono labels; `text-sm` to `text-lg` for body.

---

## Color tokens

From `tailwind.config.js`:

### Text hierarchy (`ink.*`)

| Token | Hex | Usage |
|-------|-----|-------|
| `ink-primary` | `#f0f0f0` | Primary text |
| `ink-secondary` | `#c4c4c4` | Secondary text |
| `ink-muted` | `#9a9a9a` | Labels, hints |
| `ink-faint` | `#6e6e6e` | Disabled, placeholder |

### Status semantics (`command.*`)

| Token | Hex | Meaning |
|-------|-----|---------|
| `command-stable` | `#3dd68c` | OK, connected, complete |
| `command-live` | `#4a9eff` | Active feed, in progress |
| `command-watch` | `#e8a838` | Warning, partial data |
| `command-critical` | `#e05252` | Error, offline, failed |
| `command-cyber` | `#3dd68c` | Accent (same as stable) |

Used in: feed status chips, workflow status in PI header, receipt line items.

### Panel chrome (`panel.*`)

| Token | Hex | Usage |
|-------|-----|-------|
| `panel-bg` | `#0a0a0a` | Sidebar background |
| `panel-border` | `#1a1a1a` | Panel borders, dividers |
| `panel-surface` | `#111111` | Elevated surfaces, cards |

---

## Component patterns

### Shared UI primitives

`src/components/ui/CommandControls.jsx`:

| Export | Usage |
|--------|-------|
| `ToggleChip` | Layer/source on-off pills (PDC data panel) |
| `DockButton` | Map control dock buttons |
| `PanelSection` | Collapsible panel sections |

`src/components/ui/AddressGeocodeInput.jsx` — shared geocode autocomplete (PDC + PI).

### Property Intelligence workflow HUD

`PropertyWorkflowHud.jsx` + `MapAnchoredPanel.jsx` — map-first workflow:

- **Banner:** API status, Sources dropdown, estimate, Generate
- **Body:** address search + package picker (setup); collapsible when locked
- **Modes:** `setup` (centered), `docked` (right rail), `anchored` (near pin at zoom ≥ 13.5)

CSS: `.map-workflow-hud*` in `src/index.css`.

### Status chips

`StatusChip.jsx` (from `better-world/`, reused in PI header):

- Green dot + "Stable" / "Live" / "Watch" / "Critical"
- Small mono text, colored border

### Source tier badges

`SourceTierBadge.jsx` — labels sources as public / standard / insurance-grade.

---

## Map styling

Global map styles in `src/index.css` (~1,680 lines):

| Class / element | Purpose |
|-----------------|---------|
| `.property-target-reticle` | PI map lock reticle animation |
| `.map-pin-*` | User-drawn pins (PDC) |
| `.command-scanline` | Subtle scanline overlay on map |
| Risk event markers | Zoom-scaled point markers |
| NFHL raster overlay | FEMA flood zone image layer |

Basemap: Carto Dark Matter (`src/utils/mapBasemaps.js`).

MapLibre wrapper: `src/lib/maplibre.js`

---

## Layout patterns

### Public Data Command

Full-screen command center:
- Header bar (fixed top)
- Map (center, full viewport)
- Right intelligence panel (scrollable signals)
- Left/bottom controls dock
- Modals overlay map

### Property Intelligence

Map-first viewport:
- Full-width map with anchored workflow HUD (`PropertyWorkflowHud`)
- HUD banner: API status, sources catalog dropdown, estimate, generate
- Report results: right slide-over panel when a run completes

### Home (marketing)

- Scroll-snap sections (`body.home-snap`)
- Abstract animated background (Framer Motion gradients + SVG paths)
- Full-viewport hero + pillar sections

---

## When adding UI

**Do:**
- Use existing Tailwind tokens (`ink-*`, `command-*`, `panel-*`)
- Match mono label pattern for section headers
- Reuse `MapAnchoredPanel`, `ToggleChip`, `StatusChip` where applicable
- Keep dark panel chrome consistent (`panel-bg`, `panel-border`)
- Use `font-display` for headings, `font-mono` for data labels

**Don't:**
- Introduce a component library (no shadcn, MUI, etc.)
- Use light backgrounds in product UI (marketing Home is exception with subtle gradients on black)
- Add new global CSS unless map-specific or animation-specific
- Reintroduce a fixed left sidebar in PI without updating the workflow HUD pattern

---

## Charts and data viz

- **Recharts** for earthquake radius charts (`EarthquakeRadiusCharts.jsx`)
- Dark theme: axis labels use `ink-muted`, grid lines subtle
- No chart library in Property Intelligence

---

## Print / PDF

`src/styles/report-print.css` — layout for `/reports/print/:sessionId` (Playwright target).

Separate from screen UI; uses print-friendly typography.

---

## See also

- [03-frontend-architecture.md](./03-frontend-architecture.md) — component inventory
- [tailwind.config.js](../../tailwind.config.js) — token source of truth
- [src/index.css](../../src/index.css) — global styles
